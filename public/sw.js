// 세이프맵 PWA 서비스 워커
const CACHE_NAME = 'safemap-pwa-v6';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
  '/icons/icon-maskable.png',
  '/icons/favicon-32.png'
];

// 신호가 약해 응답이 오지 않을 때 끝없이 기다리지 않도록 상한을 둔다 (응급 상황에서는 저장본이 낫다)
const NAV_TIMEOUT_MS = 3000;
const API_TIMEOUT_MS = 8000;
// 시설 목록은 화면이 7초에 저장한 자료로 먼저 답하고 서버 답을 더 기다리므로, 여기서 일찍 끊지 않는다
const FACILITIES_TIMEOUT_MS = 25000;
function fetchWithTimeout(request, ms) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// 첫 화면 HTML이 불러오는 앱 코드(JS·CSS, 파일명에 해시가 붙음)를 찾아 함께 저장
// → 처음 방문한 직후부터 인터넷 없이 앱이 열린다
async function precacheAppBundle(cache) {
  const res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put('/', res);
  const assets = [...new Set(html.match(/\/assets\/[^"'\s)]+/g) || [])];
  await Promise.all(assets.map((url) => cache.add(url).catch(() => null)));
}

// 1. 서비스 워커 설치 (캐시 선탑재)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_ASSETS);
      await precacheAppBundle(cache).catch(() => null);
    }).then(() => self.skipWaiting())
  );
});

// 2. 서비스 워커 활성화 (이전 버전 캐시 정리)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 네트워크 요청 인터셉트 (네트워크 우선 + 오프라인 폴백)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API는 항상 네트워크로만 조회하고 저장하지 않는다
  // (예전 응답을 지금 응답처럼 보여주면 "지금 이용 가능" 같은 운영 여부가 틀릴 수 있다.
  //  인터넷이 없을 때는 화면이 휴대폰에 저장한 시·도 자료로 따로 찾는다)
  if (url.pathname.startsWith('/api/offline/')) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetchWithTimeout(event.request, url.pathname === '/api/facilities' ? FACILITIES_TIMEOUT_MS : API_TIMEOUT_MS).catch(() =>
        Response.error()
      )
    );
    return;
  }

  // HTML 네비게이션 요청 (오프라인 시에도 앱 쉘 즉시 구동)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(event.request, NAV_TIMEOUT_MS)
        .then((response) => {
          // 배포 중 잠깐 나는 오류 페이지로 저장해 둔 앱 화면을 덮어쓰지 않는다
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          return response;
        })
        // 저장본이 없으면(첫 방문) 느려도 네트워크를 끝까지 기다린다
        .catch(async () => (await caches.match('/')) || fetch(event.request))
    );
    return;
  }

  // 정적 리소스 (JS, CSS, 폰트, 이미지): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
