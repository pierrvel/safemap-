// 카카오 로컬 API 기반 행정구역 조회 및 좌표 보정 (지오코딩)
const { calculateDistanceMeters } = require('./geo');
const { setBoundedCache } = require('./utils');
const { kvGet, kvSet } = require('./kvCache');
const {
  normalizeSido,
  parseAddrRegion,
  extractAddressKeys,
  extractSubKeyword,
  verifyStrictBrandMatch,
  hasStrictCommonKeyword,
} = require('./address');

const getKakaoRestApiKey = () => process.env.KAKAO_REST_API_KEY || process.env.KAKAO_MAP_API_KEY || '';

// 카카오 지도 JavaScript 키를 서버에서 호출할 때 필요한 헤더 (REST 키만 쓸 때도 무해)
const SERVICE_ORIGIN = 'https://prompt-bismuth-avyohx5.vercel.app';
const kakaoHeaders = (kakaoKey) => ({
  Authorization: `KakaoAK ${kakaoKey}`,
  KA: `sdk/1.0.0 os/javascript lang/ko-KR res/1920x1080 device/pc origin/${SERVICE_ORIGIN}`,
  Origin: SERVICE_ORIGIN,
});

// 인메모리 지오코딩 캐시 (동일 주소/기관명 반복 조회 방지 및 초고속 0ms 응답 보장)
const aedGeocodeCache = new Map();
const regionCache = new Map();

// 영구 캐시 보관 기간: 성공 결과는 30일, 실패(null)는 일시 오류일 수 있어 1일
const GEO_KV_TTL_SEC = 30 * 24 * 60 * 60;
const GEO_KV_NULL_TTL_SEC = 24 * 60 * 60;

// 지오코딩 결과를 메모리와 영구 캐시(설정된 경우)에 함께 저장
function rememberGeocode(cacheKey, value) {
  setBoundedCache(aedGeocodeCache, cacheKey, value);
  kvSet(`geo:${cacheKey}`, value, value ? GEO_KV_TTL_SEC : GEO_KV_NULL_TTL_SEC);
}

// 🌟 위경도 기준 광역 행정구역(시·도 / 시·군·구 / 읍·면·동) 조회 및 캐싱
async function getRegionInfo(lat, lon) {
  if (isNaN(lat) || isNaN(lon)) return null;
  const gridKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
  if (regionCache.has(gridKey)) {
    return regionCache.get(gridKey);
  }

  const kakaoKey = getKakaoRestApiKey();
  if (!kakaoKey) return null;

  const headers = kakaoHeaders(kakaoKey);

  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lon}&y=${lat}`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      const doc = data.documents?.find(d => d.region_type === 'B') || data.documents?.[0];
      if (doc) {
        const info = {
          sido: doc.region_1depth_name,
          sigungu: doc.region_2depth_name,
          dong: doc.region_3depth_name,
        };
        setBoundedCache(regionCache, gridKey, info);
        return info;
      }
    }
  } catch (e) {}

  setBoundedCache(regionCache, gridKey, null);
  return null;
}

// 공공데이터포털 등록 좌표의 지번/필지 오차 교차 검증 및 지오코딩 보정 함수
async function geocodeAddress(address, orgName = '', centerLat = null, centerLon = null) {
  const cacheKey = `${address || ''}|${orgName || ''}|${centerLat || ''}|${centerLon || ''}`;
  if (aedGeocodeCache.has(cacheKey)) {
    return aedGeocodeCache.get(cacheKey);
  }
  const persisted = await kvGet(`geo:${cacheKey}`);
  if (persisted !== undefined) {
    setBoundedCache(aedGeocodeCache, cacheKey, persisted);
    return persisted;
  }

  const kakaoKey = getKakaoRestApiKey();
  if (!kakaoKey) {
    return null;
  }

  const headers = kakaoHeaders(kakaoKey);

  const cleanAddr = (address || '').split(',')[0].replace(/\([^\)]*\)/g, '').trim();
  const addrSido = parseAddrRegion(cleanAddr)?.sido || '';
  const addrKeys = extractAddressKeys(cleanAddr);

  // 지오코딩 결과의 시·도가 원본 주소의 시·도와 다르면 동명 주소 오매칭으로 간주
  const isSameSido = (docAddr) => {
    if (!addrSido || !docAddr) return true;
    return normalizeSido(docAddr.trim().split(/\s+/)[0]) === addrSido;
  };

  try {
    // 1. 주요 랜드마크/기관명 키워드 검색
    // 도로명+건물번호 또는 동+지번이 원본 주소와 정확히 일치하는 결과만 같은 건물로 인정
    const isSignificantPlace = /(?:초등학교|중학교|고등학교|대학교|병원|보건소|도서관|주민센터|구청|시청|경찰서|소방서|복지관|수련관|체육센터|문화센터|아파트|타워|[가-힣0-9]+역\b)/.test(orgName);
    if (orgName && isSignificantPlace && (addrKeys.road || addrKeys.jibun)) {
      let kwUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(orgName)}`;
      if (centerLat && centerLon) {
        kwUrl += `&y=${centerLat}&x=${centerLon}&radius=3000`;
      }
      const kwRes = await fetch(kwUrl, { headers });
      if (kwRes.ok) {
        const kwData = await kwRes.json();
        const matched = (kwData.documents || []).find((d) => {
          if (!isSameSido(d.road_address_name || d.address_name)) return false;
          const docKeys = [
            extractAddressKeys(d.road_address_name).road,
            extractAddressKeys(d.address_name).jibun,
          ];
          return (addrKeys.road && docKeys[0] === addrKeys.road) || (addrKeys.jibun && docKeys[1] === addrKeys.jibun);
        });

        if (matched) {
          const res = {
            lat: parseFloat(matched.y),
            lon: parseFloat(matched.x),
            source: 'KAKAO_KEYWORD',
            precision: 'EXACT',
            matchedName: matched.place_name,
            matchedAddr: matched.road_address_name || matched.address_name,
          };
          rememberGeocode(cacheKey, res);
          return res;
        }
      }
    }

    // 2. 도로명/지번 주소 지오코딩 (점진적 폴백: 전체 주소 -> 건물번호 제외 도로명 -> 읍면동)
    // precision: EXACT(건물 단위) / ROAD(도로 단위) / DONG(읍면동 중심점)
    if (cleanAddr) {
      const candidates = [{ query: cleanAddr, precision: 'EXACT' }];
      const withoutBno = cleanAddr.replace(/\s+\d+(?:-\d+)?$/, '').trim();
      if (withoutBno && withoutBno !== cleanAddr) {
        candidates.push({ query: withoutBno, precision: 'ROAD' });
      }
      const dongMatch = cleanAddr.match(/^(?:[가-힣]+(?:시|도)\s+)?(?:[가-힣]+(?:시|군|구)\s+)?(?:[가-힣0-9]+(?:읍|면|동|가))/);
      if (dongMatch && !candidates.some((c) => c.query === dongMatch[0])) {
        candidates.push({ query: dongMatch[0], precision: 'DONG' });
      }

      for (const { query, precision } of candidates) {
        const addrUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`;
        const addrRes = await fetch(addrUrl, { headers });
        if (addrRes.ok) {
          const addrData = await addrRes.json();
          const doc = (addrData.documents || []).find((d) => isSameSido(d.address_name));
          if (doc) {
            const res = {
              lat: parseFloat(doc.y),
              lon: parseFloat(doc.x),
              source: 'KAKAO_ADDRESS',
              precision,
              matchedAddr: doc.address_name,
            };
            rememberGeocode(cacheKey, res);
            return res;
          }
        }
      }
    }
  } catch (err) {
    // 지오코딩 실패 시 안전하게 null 반환
  }

  rememberGeocode(cacheKey, null);
  return null;
}

// 🌟 상세위치(관리사무소, ○○동, 별관 등) 기반 안전한 초정밀 세부 위치 보정
async function geocodeSubLocation(orgName, buildPlace, baseLat, baseLon) {
  const subKeyword = extractSubKeyword(buildPlace);
  if (!subKeyword || !orgName) return null;

  const cacheKey = `sub|${orgName}|${subKeyword}|${baseLat}|${baseLon}`;
  if (aedGeocodeCache.has(cacheKey)) {
    return aedGeocodeCache.get(cacheKey);
  }
  const persisted = await kvGet(`geo:${cacheKey}`);
  if (persisted !== undefined) {
    setBoundedCache(aedGeocodeCache, cacheKey, persisted);
    return persisted;
  }

  const kakaoKey = getKakaoRestApiKey();
  if (!kakaoKey) return null;

  const headers = kakaoHeaders(kakaoKey);

  const cleanOrg = orgName.replace(/\(주\)|주식회사/g, '').trim();
  const query = `${cleanOrg} ${subKeyword}`;
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&y=${baseLat}&x=${baseLon}&radius=600`;

  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      const docs = data.documents || [];

      // 안전 검증: 기준 좌표 300m 이내, 세부 키워드 포함, 기관명 고유단어 및 브랜드 일치
      const matched = docs.find((d) => {
        const dLat = parseFloat(d.y);
        const dLon = parseFloat(d.x);
        if (calculateDistanceMeters(baseLat, baseLon, dLat, dLon) > 300) return false;
        if (!d.place_name.includes(subKeyword)) return false;
        if (!hasStrictCommonKeyword(d.place_name, cleanOrg)) return false;
        if (!verifyStrictBrandMatch(d.place_name, cleanOrg)) return false;
        return true;
      });

      if (matched) {
        const result = {
          lat: parseFloat(matched.y),
          lon: parseFloat(matched.x),
          matchedName: matched.place_name,
          subKeyword,
          source: 'KAKAO_SUB_LOCATION',
        };
        rememberGeocode(cacheKey, result);
        return result;
      }
    }
  } catch (err) {}

  rememberGeocode(cacheKey, null);
  return null;
}


module.exports = { getRegionInfo, geocodeAddress, geocodeSubLocation };
