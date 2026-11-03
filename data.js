// Sottoportico — dati modificabili: birre (spine e frigo) e calendario delle serate.
// Prezzi, spine "della casa" ed eventi sono ESEMPI da aggiornare.
// Le birre Lough Gill (Sligo, Irlanda) vengono da loughgillbrewery.com.

export const BEERS = [
  // --- alla spina
  { id: 'sligo-bay-tap', where: 'spina', n: 'Sligo Bay', br: 'Lough Gill', st: 'American Pale Ale', abv: 4.6, note: 'Luppoli americani in primo piano, malto di sostegno.', price: 6, col: '#2f8f83' },
  { id: 'andersons', where: 'spina', n: 'Andersons', br: 'Lough Gill', st: 'Irish Red Ale', abv: null, note: 'Rossa irlandese, maltata e morbida.', price: 6, col: '#a8402e' },
  { id: 'pils', where: 'spina', n: 'Pils locale', br: 'Birrificio pugliese', st: 'Pils', abv: 4.8, note: 'Fresca e secca, per iniziare.', price: 5, col: '#e9c46a' },
  { id: 'stout-caffe', where: 'spina', n: 'Stout al caffè', br: 'Birrificio pugliese', st: 'Stout', abv: 5.5, note: 'Tostata, con caffè di torrefazione tarantina.', price: 6, col: '#2b1d16' },
  // --- frigo, lattine Lough Gill (440 ml salvo dove indicato)
  { id: 'shaka', where: 'frigo', n: 'Shaka', br: 'Lough Gill', st: 'Session IPA', abv: 3.8, note: 'Tropicale e agrumata, corpo pieno grazie ad avena e frumento.', price: 6.5, col: '#f2a541' },
  { id: 'cutback', where: 'frigo', n: 'Cutback', br: 'Lough Gill', st: 'New England IPA', abv: 4.5, note: 'Profumi tropicali, luppoli Comet, Azacca ed El Dorado.', price: 6.5, col: '#7fb7be' },
  { id: 'sligo-bay', where: 'frigo', n: 'Sligo Bay', br: 'Lough Gill', st: 'American Pale Ale', abv: 4.6, note: 'Luppoli americani in primo piano, malto di sostegno.', price: 6.5, col: '#2f8f83' },
  { id: 'lost-armada', where: 'frigo', n: 'Lost Armada', br: 'Lough Gill', st: 'West Coast IPA', abv: 5.0, note: 'Chiara, malto equilibrato, luppolo americano deciso.', price: 6.5, col: '#b9bec4' },
  { id: 'breakers', where: 'frigo', n: 'Breakers', br: 'Lough Gill', st: 'Pale Ale senza glutine', abv: null, note: 'Pale ale gluten free.', price: 6.5, col: '#3d6fb4' },
  { id: 'lager-1928', where: 'frigo', n: '1928 Lager', br: 'Lough Gill × Sligo Rovers', st: 'Lager', abv: null, note: 'Lager in collaborazione con la squadra di Sligo.', price: 5.5, col: '#c9372c' },
  { id: 'north-star', where: 'frigo', n: 'North Star', br: 'Lough Gill', st: 'Imperial Stout barricata', abv: 12.9, note: 'Cannella, noce moscata, vaniglia e cacao. 330 ml.', price: 9, col: '#1f2a44' },
  { id: 'red-ale-can', where: 'frigo', n: 'Andersons', br: 'Lough Gill', st: 'Irish Red Ale', abv: null, note: 'Rossa irlandese, maltata e morbida.', price: 6.5, col: '#a8402e' },
];

// Orari in ora italiana. kind: dj | live | libri | birra
export const EVENTS = [
  { id: 'dj-1107', t: '2026-11-07T21:00:00+01:00', min: 180, kind: 'dj', title: 'DJ set vinile', host: 'Selector del locale', desc: 'Solo vinili, lato A e lato B. Si balla sotto il portico.' },
  { id: 'tape-1108', t: '2026-11-08T19:00:00+01:00', min: 150, kind: 'live', title: 'Tape Tales · live', host: 'Tape Tales', desc: 'Ambient e sperimentale dall\'etichetta di cassette di Taranto.' },
  { id: 'tap-1113', t: '2026-11-13T19:00:00+01:00', min: 180, kind: 'birra', title: 'Tap takeover Lough Gill', host: 'Lough Gill Brewery', desc: 'Le birre di Sligo alla spina, una serata intera.' },
  { id: 'zine-1116', t: '2026-11-16T11:00:00+01:00', min: 360, kind: 'libri', title: 'Fiera delle fanzine', host: 'Editoria indipendente', desc: 'Banchetti di fanzine, piccoli editori e illustratori.' },
  { id: 'dj-1121', t: '2026-11-21T21:00:00+01:00', min: 180, kind: 'dj', title: 'Album night', host: 'Selector del locale', desc: 'Un album intero, dall\'inizio alla fine, ascoltato insieme.' },
];

export const eur = v => (v == null ? '' : '€ ' + v.toFixed(v % 1 ? 2 : 0).replace('.', ','));
export const abvTxt = b => (b.abv == null ? '' : String(b.abv).replace('.', ',') + '%');
export function eventsFrom(now = Date.now()) {
  return EVENTS.map(e => ({ ...e, start: Date.parse(e.t), end: Date.parse(e.t) + e.min * 60000 })).filter(e => e.end > now).sort((a, b) => a.start - b.start);
}
export function liveEvent(now = Date.now()) { return eventsFrom(now).find(e => e.start <= now && now < e.end) || null; }
const fmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const whenTxt = e => fmt.format(new Date(e.start));
export function untilTxt(ms) { const m = Math.round(ms / 60000); if (m < 60) return `tra ${m} min`; const h = Math.round(m / 60); if (h < 24) return `tra ${h} h`; const d = Math.floor(h / 24); return `tra ${d} g${h % 24 ? ' ' + (h % 24) + ' h' : ''}`; }
export function gcalURL(e) {
  const z = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${e.title} · Sottoportico`, dates: `${z(e.start)}/${z(e.end)}`, details: `${e.desc}\nCon: ${e.host}`, location: 'Sottoportico, Piazzale Bestat, Taranto' });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}
