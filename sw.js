/* 旅行手帳：離線快取。網頁、圖示、Firebase 程式碼存在手機裡，沒訊號也能打開；
   行程資料由 Firebase 自己存在手機裡，有網路時自動同步。 */
const V = "travel-v1";
const PRE = V.replace(/v\d+$/, ""); /* 只清掉同一個網站的舊快取，不動同網域其他手帳 */
const CORE = ["./", "./index.html", "./code.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k.indexOf(PRE) === 0).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* 先試網路（4 秒內沒回應就先用手機裡的版本），成功就順便更新快取 */
function netFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true });
    const timer = setTimeout(() => { fromCache().then(c => { if (c && !done) { done = true; resolve(c); } }); }, 4000);
    fetch(req).then(resp => {
      if (resp && resp.ok) { const cp = resp.clone(); caches.open(V).then(c => c.put(req, cp)); }
      if (!done) { done = true; clearTimeout(timer); resolve(resp); }
    }).catch(() => fromCache().then(c => { if (!done) { done = true; clearTimeout(timer); resolve(c || Response.error()); } }));
  });
}
/* 先用手機裡的，沒有才下載（Firebase 程式碼、字型） */
function cacheFirst(req) {
  return caches.match(req).then(c => c || fetch(req).then(resp => {
    if (resp && (resp.ok || resp.type === "opaque")) { const cp = resp.clone(); caches.open(V).then(cc => cc.put(req, cp)); }
    return resp;
  }));
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.searchParams.has("ping")) return; /* 網路檢查：不要用快取回答 */
  if (u.origin === self.location.origin) { e.respondWith(netFirst(r)); return; }
  if (u.host === "www.gstatic.com" || u.host === "fonts.googleapis.com" || u.host === "fonts.gstatic.com") { e.respondWith(cacheFirst(r)); return; }
  /* 其他（Firebase 資料庫、登入）交給 Firebase 自己處理 */
});
