// Service worker של PackPal: שומר את האפליקציה במכשיר כדי שתיפתח גם בלי אינטרנט (למשל בטיסה).
// עובד רק כשהאתר מוגש ישירות (GitHub Pages), לא בתוך Streamlit.
const CACHE = 'packpal-sw-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'static/icon-192.png',
  'static/icon-512.png',
  'static/icon-maskable-192.png',
  'static/icon-maskable-512.png',
  'static/apple-touch-icon.png',
  'static/favicon-32.png',
  'static/favicon-48.png'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// מנסים קודם את הרשת (כדי לקבל גרסה חדשה), ואם אין רשת או שהיא איטית מדי – מה ששמור
function networkFirst(req, fallbackKey) {
  return new Promise((resolve) => {
    let settled = false;
    const useCache = () => caches.match(fallbackKey || req, { ignoreSearch: true }).then(r => {
      if (r && !settled) { settled = true; resolve(r); }
      return r;
    });
    const timer = setTimeout(useCache, 4000);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(fallbackKey || req, copy));
      }
      if (!settled) { settled = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      useCache().then(r => { if (!r && !settled) { settled = true; resolve(Response.error()); } });
    });
  });
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // שירותים חיצוניים (מזג אוויר, Firebase...) לא נוגעים בהם

  if (req.mode === 'navigate') {
    // כל כתובת (גם עם ?trip=) מקבלת את אותו index.html
    ev.respondWith(networkFirst(req, 'index.html'));
    return;
  }
  // קבצים סטטיים: מהמטמון מיד, ומתעדכנים ברקע
  ev.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
