// 오프라인 지도 파일 관리 (시·도별 OpenStreetMap .pmtiles → GitHub Pages)
//
//   node scripts/offline-maps.mjs pages <원본폴더> <출력폴더> <빌드날짜YYYYMMDD> <bbox.json>
//     → 출력 폴더에 지도 파일과 manifest.json을 만든다. 이 폴더를 지도 저장소(pierrvel/safemap-maps)의
//       main 브랜치로 올리면 GitHub Pages로 공개된다.
//
// 지도 파일은 Protomaps 일일 빌드에서 잘라낸다 (go-pmtiles):
//   pmtiles extract https://build.protomaps.com/<날짜>.pmtiles <원본폴더>/<지역>.pmtiles --bbox=<서,남,동,북>
//
// GitHub는 100MB가 넘는 파일을 받지 않고 50MB부터 경고하므로, 45MB씩 조각(.part0, .part1 …)으로 나눈다.
// 앱은 조각을 차례로 받아 하나로 합친다 (src/utils/offlineMapStore.js).
import { copyFileSync, existsSync, mkdirSync, openSync, readSync, closeSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PART_BYTES = 45 * 1024 * 1024;

function splitFile(src, outDir, file) {
  const size = statSync(src).size;
  if (size <= PART_BYTES) {
    copyFileSync(src, path.join(outDir, file));
    return null;
  }
  const parts = [];
  const fd = openSync(src, 'r');
  const buf = Buffer.alloc(PART_BYTES);
  for (let offset = 0, i = 0; offset < size; offset += PART_BYTES, i++) {
    const n = readSync(fd, buf, 0, PART_BYTES, offset);
    const name = `${file}.part${i}`;
    writeFileSync(path.join(outDir, name), buf.subarray(0, n));
    parts.push(name);
  }
  closeSync(fd);
  return parts;
}

function buildPages(srcDir, outDir, date, bboxFile) {
  const bboxes = JSON.parse(readFileSync(bboxFile, 'utf8'));
  mkdirSync(outDir, { recursive: true });
  const regions = {};
  for (const region of Object.keys(bboxes)) {
    const file = `${region}-${date}.pmtiles`;
    const src = [path.join(srcDir, file), path.join(srcDir, `${region}.pmtiles`)].find(existsSync);
    if (!src) {
      console.warn(`건너뜀: ${region} (파일 없음)`);
      continue;
    }
    const parts = splitFile(src, outDir, file);
    regions[region] = { file, bytes: statSync(src).size, bbox: bboxes[region], ...(parts && { parts }) };
  }
  const manifest = {
    version: 1,
    date,
    source: `Protomaps OpenStreetMap build ${date}`,
    attribution: '© OpenStreetMap contributors (ODbL)',
    regions,
  };
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  // Jekyll 변환 없이 파일을 그대로 내보낸다
  writeFileSync(path.join(outDir, '.nojekyll'), '');
  const total = Object.values(regions).reduce((s, r) => s + r.bytes, 0);
  const split = Object.entries(regions).filter(([, r]) => r.parts).map(([k, r]) => `${k}(${r.parts.length}조각)`);
  console.log(`manifest.json: ${Object.keys(regions).length}개 지역, 합계 ${(total / 1048576).toFixed(0)}MB${split.length ? `, 나눈 파일: ${split.join(', ')}` : ''}`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'pages') buildPages(...args);
else {
  console.log('사용법: node scripts/offline-maps.mjs pages <원본폴더> <출력폴더> <날짜> <bbox.json>');
  process.exit(1);
}
