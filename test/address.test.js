const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSido,
  isRegionalConflict,
  extractAddressKeys,
  extractSubKeyword,
  verifyStrictBrandMatch,
  hasStrictCommonKeyword,
} = require('../lib/address');

test('시·도 이름 정규화', () => {
  assert.equal(normalizeSido('서울특별시'), '서울');
  assert.equal(normalizeSido('경상남도'), '경남');
  assert.equal(normalizeSido('충북'), '충북');
  assert.equal(normalizeSido('세종특별자치시'), '세종');
});

test('도로명+건물번호, 동+지번 비교 키 추출', () => {
  assert.deepEqual(extractAddressKeys('서울특별시 송파구 올림픽로 300 (신천동)'), { road: '올림픽로 300', jibun: null });
  assert.deepEqual(extractAddressKeys('서울 송파구 신천동 29'), { road: null, jibun: '신천동 29' });
  assert.equal(extractAddressKeys('경기도 성남시 분당구 불정로 6-1').road, '불정로 6-1');
  assert.deepEqual(extractAddressKeys(''), { road: null, jibun: null });
});

test('같은 도로명이라도 건물번호가 다르면 다른 키', () => {
  assert.notEqual(extractAddressKeys('서울 마포구 양화로 107').road, extractAddressKeys('서울 마포구 양화로 160').road);
});

test('시·도 충돌 검사: 서울 검색 시 원거리 경기·타 시도는 충돌', () => {
  assert.equal(isRegionalConflict('경기도 여주시 가남읍 양화로 107', '서울특별시'), true);
  assert.equal(isRegionalConflict('부산광역시 해운대구 우동 1', '서울특별시'), true);
  assert.equal(isRegionalConflict('경기도 고양시 덕양구 1', '서울특별시'), false);
  assert.equal(isRegionalConflict('서울특별시 마포구 양화로 160', '서울특별시'), false);
});

test('시·도 충돌 검사: 경계 인근 타 시도는 충돌로 분류(이후 지오코딩으로 검증)', () => {
  assert.equal(isRegionalConflict('세종특별자치시 반곡동 1', '대전광역시'), true);
  assert.equal(isRegionalConflict('대전광역시 유성구 반석동 1', '대전광역시'), false);
});

test('상세위치에서 독립 건물 키워드 추출', () => {
  assert.equal(extractSubKeyword('관리사무소 1층 벽면'), '관리사무소');
  assert.equal(extractSubKeyword('101 동 1층 로비'), '101동');
  assert.equal(extractSubKeyword('경로당 입구'), '경로당');
  assert.equal(extractSubKeyword('1층 로비 안내데스크'), null);
});

test('아파트 브랜드 엄격 일치 검증', () => {
  assert.equal(verifyStrictBrandMatch('시범한양아파트 관리사무소', '시범단지한양아파트'), true);
  assert.equal(verifyStrictBrandMatch('효자촌프라자', '효자촌현대아파트'), false);
});

test('공공기관명이 다르면 공통 키워드 없음', () => {
  assert.equal(hasStrictCommonKeyword('마포구 보건소', '마포구청'), null);
  assert.ok(hasStrictCommonKeyword('한양아파트 관리사무소', '시범한양아파트'));
});
