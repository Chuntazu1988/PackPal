// שרת קטן (Cloudflare Worker) שמחפש מלון ב-Google Places ומחזיר רק כתובת, טלפון ותמונת חזית.
// מפתח ה-API נשמר כסוד בשם GOOGLE_PLACES_KEY בהגדרות ה-Worker, ולא בקוד ולא ב-GitHub.
//
// חיפוש: GET https://<השם-שלך>.workers.dev/?q=Hotel+Lutetia+Paris
// תמונה: GET https://<השם-שלך>.workers.dev/photo?name=places/XXX/photos/YYY

const ALLOWED_ORIGINS = [
  'https://chuntazu1988.github.io',
  'http://localhost:8765'
];
const SEARCH_CACHE_SECONDS = 86400;   // יום: חוסך בקשות ועלות
const PHOTO_CACHE_SECONDS = 604800;   // שבוע

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
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { headers: headers });
    if (request.method !== 'GET') return json({ error: 'method' }, 405, headers);
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: 'origin' }, 403, headers);
    if (!env.GOOGLE_PLACES_KEY) return json({ error: 'not configured' }, 500, headers);

    // תמונה: מעבירים את התמונה מגוגל בלי לחשוף את המפתח
    if (url.pathname === '/photo') {
      const name = url.searchParams.get('name') || '';
      if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) return json({ error: 'bad photo' }, 400, headers);
      const cache = caches.default;
      const key = new Request(url.origin + '/photo-cache?name=' + encodeURIComponent(name));
      const hit = await cache.match(key);
      if (hit) return hit;
      const up = await fetch('https://places.googleapis.com/v1/' + name + '/media?maxWidthPx=1200&key=' + encodeURIComponent(env.GOOGLE_PLACES_KEY));
      if (!up.ok) return json({ error: 'photo ' + up.status }, 502, headers);
      const res = new Response(up.body, { headers: { 'Content-Type': up.headers.get('Content-Type') || 'image/jpeg', 'Cache-Control': 'public, max-age=' + PHOTO_CACHE_SECONDS, 'Access-Control-Allow-Origin': '*' } });
      ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    }

    // חיפוש מלון
    const q = (url.searchParams.get('q') || '').trim().slice(0, 160);
    if (q.length < 2) return json({ error: 'bad query' }, 400, headers);
    const cacheKey = new Request(url.origin + '/search-cache?q=' + encodeURIComponent(q.toLowerCase()));
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) return new Response(await hit.text(), { headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'HIT' }, headers) });

    let up;
    try {
      up = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.googleMapsUri,places.websiteUri,places.photos'
        },
        body: JSON.stringify({ textQuery: q, includedType: 'lodging', languageCode: 'he', maxResultCount: 1 })
      });
    } catch (e) { return json({ error: 'upstream' }, 502, headers); }
    if (!up.ok) return json({ error: 'upstream ' + up.status }, 502, headers);
    const data = await up.json();
    const p = data && data.places && data.places[0];
    if (!p) return json({ found: false }, 200, headers);

    const out = { found: true };
    if (p.displayName && p.displayName.text) out.name = p.displayName.text;
    if (p.formattedAddress) out.address = p.formattedAddress;
    if (p.internationalPhoneNumber) out.phone = p.internationalPhoneNumber;
    if (p.googleMapsUri) out.mapsUrl = p.googleMapsUri;
    if (p.websiteUri) out.website = p.websiteUri;
    if (p.photos && p.photos[0] && p.photos[0].name) out.photo = url.origin + '/photo?name=' + p.photos[0].name;
    const body = JSON.stringify(out);
    ctx.waitUntil(cache.put(cacheKey, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + SEARCH_CACHE_SECONDS } })));
    return new Response(body, { headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'MISS' }, headers) });
  }
};
