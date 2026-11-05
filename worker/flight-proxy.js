// שרת קטן (Cloudflare Worker) שמסתיר את המפתח של AirLabs ומחזיר לאתר רק את מה שצריך.
// המפתח נשמר כסוד בשם AIRLABS_KEY בהגדרות ה-Worker, ולא בקוד ולא ב-GitHub.
//
// בקשה:  GET https://<השם-שלך>.workers.dev/?flight=LY315
// תשובה: JSON עם סטטוס, עיכוב, שער וטרמינל (רק השדות שקיימים).

const ALLOWED_ORIGINS = [
  'https://chuntazu1988.github.io',
  'http://localhost:8765'
];
const CACHE_SECONDS = 120;   // שומרים תשובה לשתי דקות: חוסך בקשות מהמכסה החינמית

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin'
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status: status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers) });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { headers: headers });
    if (request.method !== 'GET') return json({ error: 'method' }, 405, headers);
    // רק האתר שלנו (או בדיקה מקומית) רשאי לשאול
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: 'origin' }, 403, headers);

    const flight = (new URL(request.url).searchParams.get('flight') || '').replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(flight)) return json({ error: 'bad flight' }, 400, headers);
    if (!env.AIRLABS_KEY) return json({ error: 'not configured' }, 500, headers);

    const cacheKey = new Request('https://packpal-flight-cache/' + flight);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) {
      const body = await hit.text();
      return new Response(body, { headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'HIT' }, headers) });
    }

    let upstream;
    try {
      upstream = await fetch('https://airlabs.co/api/v9/flight?flight_iata=' + encodeURIComponent(flight) + '&api_key=' + encodeURIComponent(env.AIRLABS_KEY));
    } catch (e) {
      return json({ error: 'upstream' }, 502, headers);
    }
    if (!upstream.ok) return json({ error: 'upstream ' + upstream.status }, 502, headers);
    const data = await upstream.json();
    const f = data && data.response;
    if (!f || typeof f !== 'object') return json({ found: false }, 200, headers);

    // מחזירים רק שדות שימושיים (בלי המפתח ובלי שאר המידע)
    const pick = ['status', 'dep_iata', 'arr_iata', 'dep_time', 'dep_estimated', 'dep_delayed', 'dep_gate', 'dep_terminal',
      'arr_time', 'arr_estimated', 'arr_delayed', 'arr_gate', 'arr_terminal', 'arr_baggage', 'airline_iata', 'flight_iata'];
    const out = { found: true };
    pick.forEach(k => { if (f[k] !== undefined && f[k] !== null && f[k] !== '') out[k] = f[k]; });
    const body = JSON.stringify(out);
    ctx.waitUntil(cache.put(cacheKey, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + CACHE_SECONDS } })));
    return new Response(body, { headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'MISS' }, headers) });
  }
};
