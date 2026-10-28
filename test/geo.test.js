const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDistanceMeters, getWalkingTimeText } = require('../lib/geo');
const { mapWithConcurrency, setBoundedCache } = require('../lib/utils');
const { getNearbyShelters } = require('../lib/shelters');

test('거리 계산: 같은 점은 0m, 위도 0.001도 ≈ 111m', () => {
  assert.equal(calculateDistanceMeters(37.5, 127, 37.5, 127), 0);
  const d = calculateDistanceMeters(37.5, 127, 37.501, 127);
  assert.ok(d >= 110 && d <= 112, `${d}m`);
});

test('보행 시간 문구', () => {
  assert.equal(getWalkingTimeText(0), '약 10초');
  assert.match(getWalkingTimeText(300), /^약 4분/);
});

test('동시 실행 제한 map: 순서 유지 및 동시 실행 수 상한', async () => {
  let running = 0;
  let peak = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (x) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
    return x * 10;
  });
  assert.deepEqual(result, [10, 20, 30, 40, 50, 60]);
  assert.ok(peak <= 2);
});

test('크기 제한 캐시: 가장 오래된 항목부터 제거', () => {
  const cache = new Map();
  for (let i = 0; i < 5001; i++) setBoundedCache(cache, i, i);
  assert.equal(cache.size, 5000);
  assert.equal(cache.has(0), false);
  assert.equal(cache.has(5000), true);
});

test('대피소 반경 탐색: 5km 이내만, 가까운 순, 최대 30개', () => {
  const list = getNearbyShelters(37.5665, 126.978);
  assert.ok(list.length > 0 && list.length <= 30);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i - 1].distanceMeters <= list[i].distanceMeters);
  }
  assert.ok(list.every((s) => s.distanceMeters <= 5000));
});
