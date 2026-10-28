const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTmapTurnIcon, getTmapApiKey } = require('../lib/tmap');

test('Tmap 턴타입 아이콘 변환: 출발/도착', () => {
  assert.equal(parseTmapTurnIcon(200, 'SP'), '🏁');
  assert.equal(parseTmapTurnIcon(201, 'EP'), '🎯');
  assert.equal(parseTmapTurnIcon(0, 'SP'), '🏁');
  assert.equal(parseTmapTurnIcon(0, 'EP'), '🎯');
});

test('Tmap 턴타입 아이콘 변환: 좌/우/직진/횡단보도', () => {
  assert.equal(parseTmapTurnIcon(11, 'GP'), '⬆️', '직진');
  assert.equal(parseTmapTurnIcon(211, 'GP'), '⬆️', '횡단보도 직진');
  assert.equal(parseTmapTurnIcon(12, 'GP'), '↰', '좌회전');
  assert.equal(parseTmapTurnIcon(212, 'GP'), '↰', '좌측 횡단보도');
  assert.equal(parseTmapTurnIcon(13, 'GP'), '↱', '우회전');
  assert.equal(parseTmapTurnIcon(213, 'GP'), '↱', '우측 횡단보도');
  assert.equal(parseTmapTurnIcon(14, 'GP'), '🔄', 'U턴');
});

test('Tmap API 키 환경변수 조회', () => {
  const orig = process.env.TMAP_API_KEY;
  try {
    process.env.TMAP_API_KEY = 'test_key_123';
    assert.equal(getTmapApiKey(), 'test_key_123');
  } finally {
    process.env.TMAP_API_KEY = orig;
  }
});
