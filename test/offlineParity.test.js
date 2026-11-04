const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const server = require('../lib/operatingHours');
const REGIONS = require('../shared/offlineRegions.json');

// 화면 코드는 ES 모듈이라(이 저장소는 CommonJS) 내용을 그대로 모듈로 읽어 온다
const loadClient = () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'operatingHours.js'), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
};

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// 서버 원본 형식(item) → 오프라인 자료 형식(hours 배열)
const toHours = (item) => DAYS.flatMap((d) => [item[`${d}SttTme`] ?? null, item[`${d}EndTme`] ?? null]);

const SAMPLES = [
  { name: '24시간', item: Object.fromEntries(DAYS.flatMap((d) => [[`${d}SttTme`, '0000'], [`${d}EndTme`, '2400']])) },
  { name: '평일 주간·주말 휴무', item: { monSttTme: '0900', monEndTme: '1800' } },
  { name: '평일·토요일', item: { monSttTme: '0900', monEndTme: '1800', satSttTme: '1000', satEndTme: '1300' } },
  { name: '야간 운영', item: { monSttTme: '1800', monEndTme: '0900', tueSttTme: '1800', tueEndTme: '0900' } },
  { name: '매일 같은 시간', item: Object.fromEntries(DAYS.flatMap((d) => [[`${d}SttTme`, '0700'], [`${d}EndTme`, '2200']])) },
  { name: '이상값', item: { monSttTme: '0900', monEndTme: '2500' } },
  { name: '정보 없음', item: {} },
];
const MOMENTS = [
  { day: 1, currentTimeInt: 1000 },
  { day: 1, currentTimeInt: 2300 },
  { day: 2, currentTimeInt: 700 },
  { day: 0, currentTimeInt: 1200 },
  { day: 6, currentTimeInt: 1100 },
  { day: 3, currentTimeInt: 1500, isHoliday: true },
];

test('오프라인 운영시간 판정이 서버와 같다', async () => {
  const client = await loadClient();
  for (const { name, item } of SAMPLES) {
    for (const now of MOMENTS) {
      const expected = server.calculateAedOperatingInfo(item, { isHoliday: false, ...now });
      const actual = client.calculateAedOperatingInfo(toHours(item), { isHoliday: false, ...now });
      assert.deepEqual(actual, expected, `${name} / ${JSON.stringify(now)}`);
    }
  }
});

test('오프라인 공휴일 목록이 서버 내장 목록과 같다', () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const dates = (src) => new Set(src.match(/'\d{4}(?:\d{4})?'/g));
  assert.deepEqual(dates(read('src/utils/operatingHours.js')), dates(read('lib/holidays.js')));
});

test('오프라인 지역 목록은 키가 겹치지 않고 별칭에 대표 이름이 들어 있다', () => {
  const keys = REGIONS.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length);
  REGIONS.forEach((r) => assert.ok(r.aliases.includes(r.aedName), r.key));
});
