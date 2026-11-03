// Sottoportico Live — versione autonoma (fuori da Claude).
// Sostituisce la "stanza dal vivo" di Claude con Supabase Realtime Presence:
// ogni giocatore pubblica la sua presenza (posizione, stato, chat, console) sul canale "sottoportico-live".
// Nessuna tabella, nessun dato salvato: quando tutti escono la stanza si svuota.
(function () {
  const SUPABASE_URL = 'https://szwjurytwbvblvhqbjet.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6d2p1cnl0d2J2Ymx2aHFiamV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MzE0NzksImV4cCI6MjEwOTAwNzQ3OX0.HzQTmJbPJ6GemakL5dx7xKlyVLZLipxipYqBpOunEZs';
  const CHANNEL = 'sottoportico-live';
  const SEND_EVERY_MS = 220; // ~4-5 aggiornamenti al secondo per giocatore

  let roomP = null;
  async function makeRoom() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { realtime: { params: { eventsPerSecond: 10 } } });
    const me = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const ch = sb.channel(CHANNEL, { config: { presence: { key: me } } });
    let myP = {}, subs = [], connected = false, peersArr = [], lastSent = 0, timer = null;
    const connSubs = [];
    const build = () => {
      const st = ch.presenceState(); const arr = []; let hasMe = false;
      for (const [k, metas] of Object.entries(st)) {
        const m = (metas && metas[metas.length - 1]) || {}; const p = { ...m }; delete p.presence_ref;
        if (k === me) hasMe = true;
        arr.push({ peer: k, isMe: k === me, sameTab: k === me, kind: 'viewer', guest: false, by: null, presence: k === me ? myP : p, updatedAt: Date.now() });
      }
      if (!hasMe) arr.unshift({ peer: me, isMe: true, sameTab: true, kind: 'viewer', guest: false, by: null, presence: myP, updatedAt: Date.now() });
      peersArr = arr;
      for (const f of subs) { try { f({ peers: arr, joined: [], left: [], updated: [] }); } catch (e) { console.error(e); } }
    };
    ch.on('presence', { event: 'sync' }, build);
    const flush = async () => { timer = null; if (!connected) return; lastSent = Date.now(); try { await ch.track(myP); } catch (e) { /* ritenta al prossimo cambio */ } };
    const schedule = () => { if (timer) return; timer = setTimeout(flush, Math.max(0, SEND_EVERY_MS - (Date.now() - lastSent))); };
    const ok = await new Promise((res) => {
      let done = false;
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') { connected = true; schedule(); connSubs.forEach(f => f(true)); if (!done) { done = true; res(true); } }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { connected = false; connSubs.forEach(f => f(false)); if (!done) { done = true; res(false); } }
      });
      setTimeout(() => { if (!done) { done = true; res(false); } }, 10000);
    });
    if (!ok) { console.warn('Sottoportico: stanza dal vivo non raggiungibile'); try { sb.removeChannel(ch); } catch (e) { } return null; }
    addEventListener('pagehide', () => { try { ch.untrack(); sb.removeChannel(ch); } catch (e) { } });
    return {
      presence: async (patch) => { myP = { ...myP, ...patch }; for (const k in patch) if (patch[k] === null) delete myP[k]; schedule(); },
      onPeers: (fn) => { subs.push(fn); setTimeout(build, 0); return () => { subs = subs.filter(x => x !== fn); }; },
      peers: () => peersArr,
      connected: () => connected,
      onConnection: (fn) => { connSubs.push(fn); setTimeout(() => fn(connected), 0); return () => { }; },
      emit: async () => { }, on: () => () => { },
    };
  }
  window.SP_STANDALONE = true;
  window.claude = { use: async (name) => { if (name === 'room') { roomP = roomP || makeRoom().catch(e => { console.error(e); return null; }); return roomP; } return null; } };
})();

// album art shown in the shop (loaded at runtime from Spotify's image CDN) and offered in the DJ «vetrina»
window.SP_ALBUMS = [{"n": "The Dark Side of the Moon", "a": "Pink Floyd", "id": "4LH4d3cOWNNsVw41Gqt2kv", "img": "db216ca805faf5fe35df4ee6"}, {"n": "Kind of Blue", "a": "Miles Davis", "id": "1weenld61qoidwYuZ1GESA", "img": "387a29c90de3b2398c29c34f"}, {"n": "Discovery", "a": "Daft Punk", "id": "2noRn2Aes5aoNVsU6iWThc", "img": "1e81bff9807a9e629fce5ade"}, {"n": "Anima latina", "a": "Lucio Battisti", "id": "6Dm9F6WuFAbYrevLFAfyfZ", "img": "45b25ec74ca64e2bb08525b9"}, {"n": "Thriller", "a": "Michael Jackson", "id": "2ANVost0y2y52ema1E9xAZ", "img": "32a7d87248d1b75463483df5"}, {"n": "Rumours", "a": "Fleetwood Mac", "id": "1bt6q2SruMsBtcerNVtpZB", "img": "57df7ce0eac715cf70e519a7"}, {"n": "Unknown Pleasures", "a": "Joy Division", "id": "5Dgqy4bBg09Rdw7CQM545s", "img": "27cc8b0ed297111f53009772"}, {"n": "OK Computer", "a": "Radiohead", "id": "6dVIqQ8qmQ5GBnJ9shOYGE", "img": "c8b444df094279e70d0ed856"}, {"n": "London Calling", "a": "The Clash", "id": "6FCzvataOZh68j8OKzOt9a", "img": "628103d0e62602f00408345d"}, {"n": "Blue Train", "a": "John Coltrane", "id": "6q56DHp5aB6ATBnaTPb4YB", "img": "a5d2c34dc91d5290346fe727"}, {"n": "Crêuza de mä", "a": "Fabrizio De André", "id": "6UGZ5FUUu2W0MWtEUvEcIJ", "img": "cf39c60d4762e2213a8d91d9"}, {"n": "Trans-Europa Express", "a": "Kraftwerk", "id": "3eB8X3S4gPMQHiLdmxvvhg", "img": "aa46532db7c678a61b394de2"}, {"n": "Ziggy Stardust", "a": "David Bowie", "id": "48D1hRORqJq52qsnUYZX56", "img": "c41f4e1133b0e6c5fcf58680"}];
