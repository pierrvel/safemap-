const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateAedOperatingInfo, formatTimeStr, parseTimeField } = require('../lib/operatingHours');

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// 요일별 동일 운영시간 AED 원본 데이터 생성 (days로 특정 요일만 지정 가능)
function aed(stt, end, days = DAYS) {
  const item = {};
  for (const d of days) {
    item[`${d}SttTme`] = stt;
    item[`${d}EndTme`] = end;
  }
  return item;
}

// day: 0=일 ~ 6=토, time: HHMM 정수
const at = (day, time) => ({ day, currentTimeInt: time });

test('시간 필드 파싱: 빈 값은 null, 범위 밖은 INVALID', () => {
  assert.equal(parseTimeField(''), null);
  assert.equal(parseTimeField(undefined), null);
  assert.equal(parseTimeField('0900'), 900);
  assert.equal(parseTimeField('2500'), 'INVALID');
  assert.equal(formatTimeStr(830), '08:30');
});

test('운영시간 정보가 없으면 개방 여부를 판단하지 않음', () => {
  const info = calculateAedOperatingInfo({}, at(1, 1200));
  assert.equal(info.operatingHours, '운영시간 정보 없음');
  assert.equal(info.availableNow, null);
});

test('이상값이 있으면 원본 확인 필요로 격리', () => {
  const info = calculateAedOperatingInfo(aed('0900', '2500'), at(1, 1200));
  assert.equal(info.operatingHours, '원본 표기 확인 필요');
  assert.equal(info.availableNow, null);
});

test('24시간 운영은 항상 개방', () => {
  const info = calculateAedOperatingInfo(aed('0', '2400'), at(0, 300));
  assert.equal(info.available24h, true);
  assert.equal(info.availableNow, true);
});

test('일반 주간 운영: 시간 안은 개방, 밖은 이용 불가', () => {
  const item = aed('0900', '1800');
  assert.equal(calculateAedOperatingInfo(item, at(2, 1000)).availableNow, true);
  assert.equal(calculateAedOperatingInfo(item, at(2, 1900)).availableNow, false);
  assert.equal(calculateAedOperatingInfo(item, at(2, 1800)).availableNow, true);
});

test('자정을 넘기는 야간 운영(18:00~09:00) 판정', () => {
  const item = aed('1800', '0900');
  assert.equal(calculateAedOperatingInfo(item, at(3, 2255)).availableNow, true, '당일 밤');
  assert.equal(calculateAedOperatingInfo(item, at(3, 300)).availableNow, true, '전날 밤부터 이어진 새벽');
  assert.equal(calculateAedOperatingInfo(item, at(3, 1200)).availableNow, false, '낮');
});

test('금요일 야간 운영은 주말 미운영이어도 토요일 새벽까지 이어짐', () => {
  const item = aed('1800', '0900', ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(calculateAedOperatingInfo(item, at(6, 200)).availableNow, true, '토요일 새벽');
  assert.equal(calculateAedOperatingInfo(item, at(6, 2000)).availableNow, false, '토요일 밤');
});

test('평일 요일 시간이 비어 있으면 월요일 시간 준용, 주말 미기재는 미운영', () => {
  const item = aed('0900', '1800', ['mon']);
  assert.equal(calculateAedOperatingInfo(item, at(4, 1000)).availableNow, true, '목요일');
  assert.equal(calculateAedOperatingInfo(item, at(0, 1000)).availableNow, false, '일요일');
  assert.match(calculateAedOperatingInfo(item, at(4, 1000)).operatingHours, /주말 휴무/);
});

test('공휴일에는 24시간이 아니면 개방 여부를 미확인으로 처리', () => {
  const item = aed('0900', '1800');
  const info = calculateAedOperatingInfo(item, { ...at(3, 1000), isHoliday: true });
  assert.equal(info.availableNow, null);
  assert.match(info.operatingHours, /공휴일/);
  assert.equal(calculateAedOperatingInfo(aed('0', '2400'), { ...at(3, 1000), isHoliday: true }).availableNow, true);
});
