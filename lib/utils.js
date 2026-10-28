// 공용 캐시·비동기 유틸리티
const MAX_GEO_CACHE_SIZE = 5000;
// 캐시 크기 상한 (가장 오래된 항목부터 제거하여 메모리 누수 방지)
function setBoundedCache(cache, key, value) {
  if (cache.size >= MAX_GEO_CACHE_SIZE) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, value);
}

// 동시 실행 수를 제한한 비동기 map (카카오 API 동시 호출 폭주 방지)
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

module.exports = { setBoundedCache, mapWithConcurrency };
