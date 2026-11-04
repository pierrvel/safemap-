// 세이프맵 PWA 서비스 워커
const CACHE_NAME = 'safemap-pwa-v5';
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

  // API 요청은 항상 최신 실시간 데이터 네트워크 우선 조회
  // 성공한 GET 응답은 캐시에 보관하여 네트워크 장애 시 마지막 결과로 폴백
  // 오프라인 자료(수 MB)는 화면이 IndexedDB에 따로 저장하므로 여기서는 저장하지 않는다
  if (url.pathname.startsWith('/api/offline/')) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetchWithTimeout(event.request, API_TIMEOUT_MS)
        .then((response) => {
          if (event.request.method === 'GET' && response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || Response.error())
    );
    return;
  }

  // HTML 네비게이션 요청 (오프라인 시에도 앱 쉘 즉시 구동)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(event.request, NAV_TIMEOUT_MS)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
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
