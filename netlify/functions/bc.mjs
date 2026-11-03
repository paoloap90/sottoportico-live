// Reads a public Bandcamp track/album page and returns what the embedded player needs.
export default async (req) => {
  const u = new URL(req.url).searchParams.get('url') || '';
  if (!/^https:\/\/[a-z0-9-]+\.bandcamp\.com\/(track|album)\/[A-Za-z0-9-]+$/i.test(u)) return Response.json({ error: 'link non valido' }, { status: 400 });
  try {
    const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (Sottoportico Live)' } });
    if (!r.ok) return Response.json({ error: 'pagina non trovata' }, { status: 404 });
    const h = await r.text();
    const unq = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    const pm = h.match(/<meta name="bc-page-properties" content="([^"]+)"/);
    const props = pm ? JSON.parse(unq(pm[1])) : {};
    const meta = k => { const m = h.match(new RegExp(`<meta property="og:${k}" content="([^"]*)"`)); return m ? unq(m[1]) : ''; };
    const title = meta('title'); const [t, a] = title.split(', by ');
    const type = props.item_type === 'a' ? 'album' : props.item_type === 't' ? 'track' : '';
    if (!type || !props.item_id) return Response.json({ error: 'non riconosciuto' }, { status: 422 });
    return Response.json({ type, id: props.item_id, title: t || title, artist: a || '', art: meta('image') }, { headers: { 'cache-control': 'public, max-age=86400' } });
  } catch (e) { return Response.json({ error: 'errore' }, { status: 502 }); }
};
export const config = { path: '/api/bc' };
