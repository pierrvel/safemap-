// 영구 캐시 (Upstash Redis / Vercel KV REST API)
// - KV_REST_API_URL, KV_REST_API_TOKEN 환경변수가 있을 때만 동작하고, 없으면 아무 것도 하지 않음
// - 서버리스 인스턴스가 새로 떠도 위치 보정 결과를 재사용해 첫 조회 속도와 카카오 API 사용량을 줄임
// - 응급 응답을 늦추지 않도록 짧은 타임아웃을 두고, 실패는 조용히 무시
const KV_TIMEOUT_MS = 800;

const getConfig = () => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
};

async function runCommand(command) {
  const config = getConfig();
  if (!config) return undefined;
  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(KV_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.result;
  } catch (e) {
    return undefined;
  }
}

// 반환값: 저장된 값(null 포함) / 없거나 KV 미설정이면 undefined
async function kvGet(key) {
  const raw = await runCommand(['GET', key]);
  if (raw === undefined || raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return undefined;
  }
}

function kvSet(key, value, ttlSeconds) {
  // 응답을 기다리지 않음 (저장 실패해도 다음 조회에서 다시 계산)
  runCommand(['SET', key, JSON.stringify(value), 'EX', String(ttlSeconds)]);
}

const isKvEnabled = () => !!getConfig();

module.exports = { kvGet, kvSet, isKvEnabled };
