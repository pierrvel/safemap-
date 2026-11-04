// 오프라인 자료용 AED 운영시간 판정 (인터넷 없이 휴대폰에서 계산)
// ※ 서버 lib/operatingHours.js·lib/holidays.js와 같은 규칙이어야 한다 (test/offlineParity.test.js가 확인)

// 매년 같은 날짜의 양력 공휴일 (MMDD)
const FIXED_HOLIDAYS = new Set(['0101', '0301', '0505', '0606', '0815', '1003', '1009', '1225']);
// 음력 공휴일·대체공휴일·선거일 등 (YYYYMMDD)
const VARIABLE_HOLIDAYS = new Set([
  '20260216', '20260217', '20260218', '20260302', '20260524', '20260525', '20260603',
  '20260817', '20260924', '20260925', '20260926', '20261005',
  '20270206', '20270207', '20270208', '20270209', '20270513', '20270816',
  '20270914', '20270915', '20270916', '20271004', '20271011', '20271227',
]);

export function getKstNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(date);
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const dateKey = `${map.year}${map.month}${map.day}`;
  return {
    day: dayMap[map.weekday],
    hour,
    minute,
    currentTimeInt: hour * 100 + minute,
    dateKey,
    isHoliday: FIXED_HOLIDAYS.has(dateKey.slice(4)) || VARIABLE_HOLIDAYS.has(dateKey),
  };
}

function formatTimeStr(t) {
  const s = String(t).padStart(4, '0');
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

function parseTimeField(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return null;
  if (n < 0 || n > 2400) return 'INVALID';
  return n;
}

/**
 * hours: [일 시작, 일 끝, 월 시작, 월 끝, … 토 시작, 토 끝] (오프라인 자료 형식)
 * 반환: { operatingHours, available24h, availableNow }
 */
export function calculateAedOperatingInfo(hours, now = getKstNow()) {
  const t = (hours || []).map(parseTimeField);
  const [sunStt, sunEnd, monStt, monEnd, tueStt, tueEnd, wedStt, wedEnd, thuStt, thuEnd, friStt, friEnd, satStt, satEnd] = t;
  const allTimes = [monStt, monEnd, tueStt, tueEnd, wedStt, wedEnd, thuStt, thuEnd, friStt, friEnd, satStt, satEnd, sunStt, sunEnd];

  if (allTimes.some((v) => v === 'INVALID')) {
    return { operatingHours: '원본 표기 확인 필요', available24h: false, availableNow: null };
  }
  if (allTimes.every((v) => v === null || v === undefined)) {
    return { operatingHours: '운영시간 정보 없음', available24h: false, availableNow: null };
  }
  if (monStt === 0 && monEnd === 2400 && satStt === 0 && satEnd === 2400 && sunStt === 0 && sunEnd === 2400) {
    return { operatingHours: '24시간 상시 개방', available24h: true, availableNow: true };
  }

  const has = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined;
  let operatingHours = '운영시간 정보 없음';
  if (has(monStt, monEnd)) {
    const hasSat = has(satStt, satEnd);
    const hasSun = has(sunStt, sunEnd);
    if (!hasSat && !hasSun) {
      operatingHours = `평일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)} (주말 휴무)`;
    } else if (hasSat && hasSun && satStt === monStt && satEnd === monEnd && sunStt === monStt && sunEnd === monEnd) {
      operatingHours = `매일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)}`;
    } else if (hasSat) {
      operatingHours = `평일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)} (토 ${formatTimeStr(satStt)}~${formatTimeStr(satEnd)})`;
    } else {
      operatingHours = `평일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)}`;
    }
  } else if (has(satStt, satEnd)) {
    operatingHours = `주말 ${formatTimeStr(satStt)}~${formatTimeStr(satEnd)}`;
  }

  const { day, currentTimeInt } = now;
  const weekWindows = [
    [sunStt, sunEnd], [monStt, monEnd], [tueStt, tueEnd], [wedStt, wedEnd],
    [thuStt, thuEnd], [friStt, friEnd], [satStt, satEnd],
  ];
  const getDayWindow = (d) => {
    const [s, e] = weekWindows[d];
    if (has(s, e)) return [s, e];
    if (d >= 1 && d <= 5 && has(monStt, monEnd)) return [monStt, monEnd];
    return null;
  };

  let availableNow = false;
  const today = getDayWindow(day);
  if (today) {
    const [s, e] = today;
    availableNow = s <= e ? currentTimeInt >= s && currentTimeInt <= e : currentTimeInt >= s;
  }
  const yesterday = getDayWindow((day + 6) % 7);
  if (!availableNow && yesterday && yesterday[0] > yesterday[1] && currentTimeInt <= yesterday[1]) {
    availableNow = true;
  }

  if (now.isHoliday) {
    return { operatingHours: `${operatingHours} · 공휴일 운영 미확인`, available24h: false, availableNow: null };
  }
  return { operatingHours, available24h: false, availableNow };
}
