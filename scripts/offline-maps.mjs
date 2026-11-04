// 오프라인 지도 파일 관리 (시·도별 OpenStreetMap .pmtiles)
//
//   node scripts/offline-maps.mjs manifest <폴더> <빌드날짜YYYYMMDD> <bbox.json>
//     → 폴더의 <지역>.pmtiles를 <지역>-<날짜>.pmtiles로 바꾸고 manifest.json을 만든다
//   node scripts/offline-maps.mjs upload <폴더>
//     → manifest.json과 지도 파일을 Cloudflare R2 버킷에 올리고, 세이프맵 주소에서 받을 수 있게 CORS를 설정한다
//
// 지도 파일은 Protomaps 일일 빌드에서 잘라낸다 (go-pmtiles):
//   pmtiles extract https://build.protomaps.com/<날짜>.pmtiles <폴더>/<지역>.pmtiles --bbox=<서,남,동,북>
//
// R2 접속 정보는 .env에서 읽는다 (화면에 출력하지 않음):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET(기본 safemap-maps)
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const APP_ORIGINS = ['https://prompt-bismuth-avyohx5.vercel.app', 'http://localhost:3000'];

function buildManifest(dir, date, bboxFile) {
  const bboxes = JSON.parse(readFileSync(bboxFile, 'utf8'));
  const regions = {};
  for (const region of Object.keys(bboxes)) {
    const plain = path.join(dir, `${region}.pmtiles`);
    const file = `${region}-${date}.pmtiles`;
    const dated = path.join(dir, file);
    if (existsSync(plain)) renameSync(plain, dated);
    if (!existsSync(dated)) {
      console.warn(`건너뜀: ${region} (파일 없음)`);
      continue;
    }
    regions[region] = { file, bytes: statSync(dated).size, bbox: bboxes[region] };
  }
  const manifest = {
    version: 1,
    date,
    source: `Protomaps OpenStreetMap build ${date}`,
    attribution: '© OpenStreetMap contributors (ODbL)',
    regions,
  };
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const total = Object.values(regions).reduce((s, r) => s + r.bytes, 0);
  console.log(`manifest.json: ${Object.keys(regions).length}개 지역, 합계 ${(total / 1048576).toFixed(0)}MB`);
}

// --- AWS 서명 v4 (R2는 S3 호환) ---
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

function signedRequest({ method, key, query = '', body, headers = {}, unsignedPayload = false }) {
  const account = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET || 'safemap-maps';
  const host = `${account}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const canonicalPath = key ? `/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}` : `/${bucket}`;
  const payloadHash = unsignedPayload ? 'UNSIGNED-PAYLOAD' : sha256(body || '');
  const allHeaders = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...headers };
  const names = Object.keys(allHeaders).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(allHeaders).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonical = [method, canonicalPath, query, names.map((n) => `${n}:${lower[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  let k = hmac(`AWS4${process.env.R2_SECRET_ACCESS_KEY}`, day);
  k = hmac(k, 'auto');
  k = hmac(k, 's3');
  k = hmac(k, 'aws4_request');
  const signature = createHmac('sha256', k).update(toSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${process.env.R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  const url = `https://${host}${canonicalPath}${query ? `?${query}` : ''}`;
  return fetch(url, { method, body, headers: { ...allHeaders, Authorization: authorization } });
}

async function putObject(key, body, contentType, cacheControl) {
  const res = await signedRequest({
    method: 'PUT',
    key,
    body,
    unsignedPayload: true,
    headers: { 'content-type': contentType, 'cache-control': cacheControl },
  });
  if (!res.ok) throw new Error(`${key} 올리기 실패: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

async function putCors() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration><CORSRule>${APP_ORIGINS.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join('')}<AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>Content-Length</ExposeHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>86400</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
  const body = Buffer.from(xml);
  const res = await signedRequest({
    method: 'PUT',
    key: '',
    query: 'cors=',
    body,
    headers: { 'content-type': 'application/xml', 'content-md5': createHash('md5').update(body).digest('base64') },
  });
  if (!res.ok) throw new Error(`CORS 설정 실패: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

async function upload(dir) {
  for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
    if (!process.env[name]) throw new Error(`.env에 ${name}가 없어요.`);
  }
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  await putCors();
  console.log('CORS 설정 완료:', APP_ORIGINS.join(', '));
  for (const [region, entry] of Object.entries(manifest.regions)) {
    const t0 = Date.now();
    // 파일 이름에 날짜가 있어 내용이 바뀌지 않으므로 오래 캐시해도 된다
    await putObject(entry.file, readFileSync(path.join(dir, entry.file)), 'application/octet-stream', 'public, max-age=31536000, immutable');
    console.log(`올림: ${region} ${(entry.bytes / 1048576).toFixed(0)}MB (${((Date.now() - t0) / 1000).toFixed(0)}초)`);
  }
  // 목록은 마지막에 올려, 파일이 다 올라간 뒤에만 앱이 새 지도를 보게 한다
  await putObject('manifest.json', Buffer.from(JSON.stringify(manifest)), 'application/json', 'public, max-age=300');
  console.log('manifest.json 올림 — 완료');
}

const [cmd, dir, ...rest] = process.argv.slice(2);
if (existsSync('.env')) process.loadEnvFile('.env');
if (cmd === 'manifest') buildManifest(dir, rest[0], rest[1]);
else if (cmd === 'upload') await upload(dir);
else {
  console.log('사용법: node scripts/offline-maps.mjs manifest <폴더> <날짜> <bbox.json> | upload <폴더>');
  process.exit(1);
}
