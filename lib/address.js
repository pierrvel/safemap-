// 주소 파싱·행정구역 비교·시설명 매칭 규칙 (외부 API 호출 없는 순수 함수)
function normalizeSido(str) {
  if (!str) return '';
  if (/^서울/.test(str)) return '서울';
  if (/^경기/.test(str)) return '경기';
  if (/^인천/.test(str)) return '인천';
  if (/^강원/.test(str)) return '강원';
  if (/^부산/.test(str)) return '부산';
  if (/^대구/.test(str)) return '대구';
  if (/^광주/.test(str)) return '광주';
  if (/^대전/.test(str)) return '대전';
  if (/^울산/.test(str)) return '울산';
  if (/^세종/.test(str)) return '세종';
  if (/^충[청]?북/.test(str)) return '충북';
  if (/^충[청]?남/.test(str)) return '충남';
  if (/^전[라]?북/.test(str)) return '전북';
  if (/^전[라]?남/.test(str)) return '전남';
  if (/^경[상]?북/.test(str)) return '경북';
  if (/^경[상]?남/.test(str)) return '경남';
  if (/^제주/.test(str)) return '제주';
  return str;
}

function parseAddrRegion(addr) {
  if (!addr) return null;
  const tokens = addr.trim().split(/\s+/);
  if (tokens.length === 0) return null;
  return {
    sido: normalizeSido(tokens[0]),
    sigungu: tokens[1] || '',
  };
}

// 🌟 주소 텍스트와 검색 중심 위치 간의 명백한 광역 행정구역 충돌(오염 데이터) 검사
function isRegionalConflict(addr, centerSido, centerSigungu) {
  const parsed = parseAddrRegion(addr);
  if (!parsed || !parsed.sido) return false;

  const cSido = normalizeSido(centerSido);
  if (!cSido) return false;

  if (cSido === '서울') {
    // 서울 검색 시 타 광역시/도(부산, 대구, 광주, 강원 등)는 무조건 불일치
    if (parsed.sido !== '서울' && parsed.sido !== '경기' && parsed.sido !== '인천') {
      return true;
    }
    // 경기도 시설인 경우, 서울 인접 시/군이 아니면 원거리 불일치(여주, 이천, 안성, 평택 등)
    if (parsed.sido === '경기') {
      const isFarGyeonggi = /여주|이천|안성|평택|가평|양평|연천|포천|동두천/.test(parsed.sigungu);
      if (isFarGyeonggi) return true;
    }
  } else if (cSido === '경기') {
    if (parsed.sido !== '경기' && parsed.sido !== '서울' && parsed.sido !== '인천') {
      return true;
    }
  } else {
    if (parsed.sido !== cSido) {
      return true;
    }
  }
  return false;
}


// 주소에서 "도로명 건물번호"와 "동/리 지번" 비교 키 추출 (예: "올림픽로 300", "잠실동 40-1")
function extractAddressKeys(addr) {
  if (!addr) return { road: null, jibun: null };
  const road = addr.match(/([가-힣0-9.]+(?:로|길))\s*(\d+(?:-\d+)?)/);
  const jibun = addr.match(/([가-힣0-9]+(?:동|리|가))\s+(?:산\s*)?(\d+(?:-\d+)?)/);
  return {
    road: road ? `${road[1]} ${road[2]}` : null,
    jibun: jibun ? `${jibun[1]} ${jibun[2]}` : null,
  };
}

// 🌟 상세위치(buildPlace)에서 관리사무소, 동, 별관 등 독립 건물 키워드 추출
function extractSubKeyword(buildPlace) {
  if (!buildPlace) return null;
  const dongMatch = buildPlace.match(/(\d{1,4}\s*동)/);
  if (dongMatch) return dongMatch[1].replace(/\s+/g, '');
  if (/관리사무[소|실]|관리실/.test(buildPlace)) return '관리사무소';
  if (/경로당|노인정/.test(buildPlace)) return '경로당';
  if (/어린이집/.test(buildPlace)) return '어린이집';
  if (/별관/.test(buildPlace)) return '별관';
  if (/신관/.test(buildPlace)) return '신관';
  if (/커뮤니티센터|주민공동시설/.test(buildPlace)) return '커뮤니티센터';
  return null;
}

const REGION_WORDS = new Set(['서울', '경기', '성남', '분당', '수지', '기흥', '일산', '인천', '수원', '용인', '서현', '이매', '수내', '판교', '야탑', '정자']);
const GENERIC_BUILDING_WORDS = new Set(['아파트', '아파', '파트', '단지', '병원', '학교', '초등', '중학', '고등', '대학', '센터', '공원', '빌딩', '타워']);

const PREFIX_REGEX = /^(?:효자촌|시범단지|시범|이매촌|아름마을|샛별마을|탑마을|푸른마을|상록마을|양지마을|파크타운|백현마을|판교|분당|성남)/;

function verifyStrictBrandMatch(docName, orgName) {
  let clean = orgName.replace(/\(주\)|주식회사/g, '').trim();
  clean = clean.replace(PREFIX_REGEX, '').trim();
  clean = clean.replace(/아파트|빌딩|타워|오피스텔/g, '').trim();
  if (clean && clean.length >= 2) {
    if (!docName.includes(clean)) {
      return false;
    }
  }
  return true;
}

function hasStrictCommonKeyword(docName, orgName) {
  const clean = orgName.replace(/\(주\)|주식회사/g, '').trim();
  const publicOffices = ['구청', '시청', '보건소', '소방서', '경찰서', '주민센터', '행정복지센터'];
  for (const po of publicOffices) {
    if (clean.includes(po) && !docName.includes(po)) {
      return null;
    }
  }

  for (let len = Math.min(4, clean.length); len >= 2; len--) {
    for (let i = 0; i <= clean.length - len; i++) {
      const sub = clean.substring(i, i + len);
      if (!REGION_WORDS.has(sub) && !GENERIC_BUILDING_WORDS.has(sub)) {
        if (docName.includes(sub)) {
          return sub;
        }
      }
    }
  }
  return null;
}


module.exports = {
  normalizeSido,
  parseAddrRegion,
  isRegionalConflict,
  extractAddressKeys,
  extractSubKeyword,
  verifyStrictBrandMatch,
  hasStrictCommonKeyword,
};
