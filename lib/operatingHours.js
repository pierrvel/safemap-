// AED 운영시간 정규화 및 현재 개방 여부 판정
// 한국 표준시 (KST, UTC+9) 기준 현재 요일 및 시각 계산 (Vercel 클라우드 서버 UTC 시차 완벽 보정)
function getKstNow() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hourCycle: 'h23', // 자정을 '24시'가 아닌 '00시'로 표기
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
  });
  const parts = formatter.formatToParts(new Date());
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[map.weekday] !== undefined ? dayMap[map.weekday] : (new Date().getUTCDay() + 1) % 7;
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  // dateKey: 공휴일 조회용 'YYYYMMDD'
  return { day, hour, minute, currentTimeInt: hour * 100 + minute, dateKey: `${map.year}${map.month}${map.day}` };
}

// 시간 문자열 포맷팅 (예: 830 -> "08:30")
function formatTimeStr(t) {
  if (t === undefined || t === null || t === '') return '';
  const s = String(t).padStart(4, '0');
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

function parseTimeField(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  if (n < 0 || n > 2400) return 'INVALID';
  return n;
}

/**
 * 🌟 [5] 24시간 여부, 운영시간 요약, 현재 개방 여부를 하나의 통합 함수에서 일관되게 계산
 * - 모순 발생 원천 차단: 24시간 여부, 요약 문자열, 현재 개방 여부 일원화
 * - 이상값(0~2400 범위 외)은 '원본 표기 확인 필요' 및 availableNow: null로 격리
 * - 시간 정보 부재 시 '운영시간 정보 없음' 및 availableNow: null로 처리
 */
function calculateAedOperatingInfo(item, now = getKstNow()) {
  if (!item) {
    return {
      operatingHours: '운영시간 정보 없음',
      available24h: false,
      availableNow: null,
    };
  }

  const monStt = parseTimeField(item.monSttTme);
  const monEnd = parseTimeField(item.monEndTme);
  const tueStt = parseTimeField(item.tueSttTme);
  const tueEnd = parseTimeField(item.tueEndTme);
  const wedStt = parseTimeField(item.wedSttTme);
  const wedEnd = parseTimeField(item.wedEndTme);
  const thuStt = parseTimeField(item.thuSttTme);
  const thuEnd = parseTimeField(item.thuEndTme);
  const friStt = parseTimeField(item.friSttTme);
  const friEnd = parseTimeField(item.friEndTme);
  const satStt = parseTimeField(item.satSttTme);
  const satEnd = parseTimeField(item.satEndTme);
  const sunStt = parseTimeField(item.sunSttTme);
  const sunEnd = parseTimeField(item.sunEndTme);

  const allTimes = [
    monStt, monEnd, tueStt, tueEnd, wedStt, wedEnd,
    thuStt, thuEnd, friStt, friEnd, satStt, satEnd, sunStt, sunEnd,
  ];

  // 1. 0000~2400 범위를 벗어난 이상값(예: 2500) 감지
  if (allTimes.some((t) => t === 'INVALID')) {
    return {
      operatingHours: '원본 표기 확인 필요',
      available24h: false,
      availableNow: null,
    };
  }

  // 2. 시간 정보가 전혀 없는 경우
  if (allTimes.every((t) => t === null)) {
    return {
      operatingHours: '운영시간 정보 없음',
      available24h: false,
      availableNow: null,
    };
  }

  // 3. 24시간 여부 확인: 평일/주말 모두 00:00~24:00인 경우
  const isMon24 = monStt === 0 && monEnd === 2400;
  const isSat24 = satStt === 0 && satEnd === 2400;
  const isSun24 = sunStt === 0 && sunEnd === 2400;

  if (isMon24 && isSat24 && isSun24) {
    return {
      operatingHours: '24시간 상시 개방',
      available24h: true,
      availableNow: true,
    };
  }

  // 4. 일반 요약 문구 생성
  let operatingHours = '운영시간 정보 없음';
  if (monStt !== null && monEnd !== null) {
    const hasSat = satStt !== null && satEnd !== null;
    const hasSun = sunStt !== null && sunEnd !== null;
    if (!hasSat && !hasSun) {
      operatingHours = `평일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)} (주말 휴무)`;
    } else if (
      hasSat &&
      hasSun &&
      satStt === monStt &&
      satEnd === monEnd &&
      sunStt === monStt &&
      sunEnd === monEnd
    ) {
      operatingHours = `매일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)}`;
    } else if (hasSat) {
      operatingHours = `평일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)} (토 ${formatTimeStr(satStt)}~${formatTimeStr(satEnd)})`;
    } else {
      operatingHours = `평일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)}`;
    }
  } else if (satStt !== null && satEnd !== null) {
    operatingHours = `주말 ${formatTimeStr(satStt)}~${formatTimeStr(satEnd)}`;
  }

  // 5. 현재 KST 시각 기준 개방 여부 판정
  const { day, currentTimeInt } = now;

  const weekWindows = [
    [sunStt, sunEnd], [monStt, monEnd], [tueStt, tueEnd], [wedStt, wedEnd],
    [thuStt, thuEnd], [friStt, friEnd], [satStt, satEnd],
  ];
  // 해당 요일 운영시간 (평일인데 시간이 없으면 월요일 시간 준용, 주말 미기재는 미운영)
  const getDayWindow = (d) => {
    const [s, e] = weekWindows[d];
    if (s !== null && e !== null) return [s, e];
    if (d >= 1 && d <= 5 && monStt !== null && monEnd !== null) return [monStt, monEnd];
    return null;
  };

  let availableNow = false;
  const today = getDayWindow(day);
  if (today) {
    const [s, e] = today;
    // 자정을 넘기는 야간 운영(예: 18:00~09:00)은 오늘 시작 시각 이후를 개방으로 판정
    availableNow = s <= e ? currentTimeInt >= s && currentTimeInt <= e : currentTimeInt >= s;
  }
  // 전날 야간 운영이 오늘 새벽까지 이어지는 경우
  const yesterday = getDayWindow((day + 6) % 7);
  if (!availableNow && yesterday && yesterday[0] > yesterday[1] && currentTimeInt <= yesterday[1]) {
    availableNow = true;
  }

  // 공공데이터에는 공휴일 운영시간이 없으므로, 공휴일에는 24시간 시설이 아니면 개방 여부를 단정하지 않음
  if (now.isHoliday) {
    return {
      operatingHours: `${operatingHours} · 공휴일 운영 미확인`,
      available24h: false,
      availableNow: null,
    };
  }

  return {
    operatingHours,
    available24h: false,
    availableNow,
  };
}

module.exports = { getKstNow, formatTimeStr, parseTimeField, calculateAedOperatingInfo };
