/**
 * =============================================================================
 * 👷 Service Worker (sw.js)
 * =============================================================================
 * オフライン時でも電波切れを気にせず思考に集中できるよう、
 * HTML、CSS、JavaScriptなどのファイルを自動キャッシュします。
 */

const CACHE_NAME = 'hiramek-cache-v18';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/state.js',
  './js/treeCanvas.js',
  './js/aiEngine.js',
  './js/pwa.js',
  './manifest.webmanifest'
];

// インストール時にコアアセットをキャッシュ＆即座に待機解除
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('👷 Service Worker: 最新ファイルをキャッシュしました');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 有効化時に古いキャッシュを全削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('👷 Service Worker: 古いキャッシュを即時削除:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 通信リクエスト時: ネットワーク優先 (Network-First) で最新を即取得し、オフライン時はキャッシュ
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // 取得成功したらキャッシュも最新に更新
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // オフライン時はキャッシュから返す
        return caches.match(event.request);
      })
  );
});
