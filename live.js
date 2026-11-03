// Sottoportico LIVE — shared presence, avatars, beers, seats, DJ console with synced synth music, chat.
// Everything other viewers send arrives as presence (untrusted display data): never HTML, never authority.

const AVATARS = [];
for (const g of ['Female', 'Male']) for (let i = 1; i <= 16; i++) { if (g === 'Female' && i === 16) continue; AVATARS.push(`${g}_Adult_${String(i).padStart(2, '0')}`); }
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, n);

// ------------------------------------------------------------------ music engine
const TRACKS = [
  { name: 'Lo-fi Mar Piccolo', bpm: 84, swing: 0.58, kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], hatVol: 0.05, bass: [[0, 41], [10, 41]], bassType: 'sine', chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], chordSteps: [0], chordLen: 15, pad: 'rhodes', cut: 1800 },
  { name: 'House del Porto', bpm: 122, swing: 0.5, kick: [0, 4, 8, 12], clap: [4, 12], hat: [2, 6, 10, 14], hatOpen: true, hatVol: 0.08, bass: [[2, 45], [6, 45], [10, 48], [14, 45]], bassType: 'saw', chords: [[57, 60, 64, 67], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], chordSteps: [3, 10], chordLen: 1.5, pad: 'stab', cut: 2600 },
  { name: 'Ambient Ionio', bpm: 70, swing: 0.5, kick: [], hat: [], bass: [[0, 36]], bassType: 'sine', chords: [[48, 55, 62, 64, 71], [45, 52, 59, 60, 67], [41, 48, 55, 57, 64], [43, 50, 57, 59, 66]], chordSteps: [0], chordLen: 16, pad: 'pad', cut: 1400, bells: true },
  { name: 'Funk Salinella', bpm: 104, swing: 0.55, kick: [0, 3, 8, 10], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], hatVol: 0.035, bass: [[0, 40], [3, 40], [6, 43], [7, 45], [10, 40], [12, 47], [14, 45]], bassType: 'square', chords: [[52, 56, 62, 66], [52, 56, 62, 66], [57, 61, 67, 71], [55, 59, 65, 69]], chordSteps: [2, 6, 11, 14], chordLen: 0.6, pad: 'clav', cut: 3200 },
  { name: 'Dub Bestat', bpm: 76, swing: 0.5, kick: [8], snare: [8], rim: [4, 12], hat: [2, 6, 10, 14], hatVol: 0.04, bass: [[0, 38], [3, 38], [6, 41], [10, 43], [12, 41]], bassType: 'sine', chords: [[62, 65, 69], [62, 65, 69], [60, 64, 67], [60, 64, 67]], chordSteps: [4, 12], chordLen: 0.7, pad: 'skank', cut: 2200, delay: 0.45 },
  { name: 'Techno Taras', bpm: 128, swing: 0.5, kick: [0, 4, 8, 12], clap: [4, 12], hat: [2, 6, 10, 14], hatVol: 0.07, bass: [[0, 33], [1, 33], [2, 45], [3, 33], [4, 33], [5, 36], [6, 33], [7, 45], [8, 33], [9, 33], [10, 43], [11, 33], [12, 33], [13, 36], [14, 45], [15, 33]], bassType: 'acid', chords: [], pad: 'none', cut: 900 },
  { name: 'Bossa in terrazza', bpm: 132, swing: 0.5, kick: [0, 6, 8, 14], rim: [0, 3, 6, 10, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], hatVol: 0.03, bass: [[0, 38], [6, 45], [8, 43], [14, 38]], bassType: 'sine', chords: [[50, 53, 57, 60, 64], [43, 53, 57, 59, 64], [48, 52, 55, 59, 62], [45, 49, 55, 57, 61]], chordSteps: [0, 3, 6, 10, 12], chordLen: 0.9, pad: 'pluck', cut: 2400 },
  { name: 'Disco Taras', bpm: 118, swing: 0.5, kick: [0, 4, 8, 12], clap: [4, 12], hat: [2, 6, 10, 14], hatOpen: true, hatVol: 0.07, bass: [[0, 40], [2, 52], [4, 40], [6, 52], [8, 45], [10, 57], [12, 45], [14, 57]], bassType: 'saw', chords: [[64, 67, 71, 74], [64, 67, 71, 74], [69, 72, 76, 79], [69, 72, 76, 79]], chordSteps: [0], chordLen: 15, pad: 'strings', cut: 3000 },
];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

class Music {
  constructor() { this.ctx = null; this.decks = [null, null]; this.xf = 0; this.vol = 0.8; this.space = 1; this.muted = false; }
  get cur() { return this.decks[0] || this.decks[1]; }
  init() {
    if (this.ctx) return; const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = this.ctx = new C();
    this.master = c.createGain(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.delay = c.createDelay(1.5); this.fb = c.createGain(); this.fb.gain.value = 0.35; const dl = c.createGain(); dl.gain.value = 0.3;
    this.delay.connect(this.fb).connect(this.delay); this.delay.connect(dl).connect(this.master);
    this.deckGain = [c.createGain(), c.createGain()]; this.deckGain.forEach(g => g.connect(this.master));
    const len = c.sampleRate; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = b;
    this.timer = setInterval(() => this.tick(), 25);
  }
  resume() { this.ctx?.resume?.(); }
  setLevel() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const v = this.muted ? 0 : this.vol * this.space; this.master.gain.setTargetAtTime(v, t, 0.25);
    const ga = Math.cos(this.xf * Math.PI / 2), gb = Math.sin(this.xf * Math.PI / 2);
    this.deckGain[0].gain.setTargetAtTime(this.decks[0] ? ga : 0, t, 0.08); this.deckGain[1].gain.setTargetAtTime(this.decks[1] ? gb : 0, t, 0.08);
  }
  setDeck(i, trackIdx, startMs) {
    if (!this.ctx) return; const tr = TRACKS[trackIdx];
    if (!tr) { this.decks[i] = null; this.setLevel(); return; }
    const d = this.decks[i]; if (d && d.idx === trackIdx && d.start === startMs) return;
    const stepDur = 60 / tr.bpm / 4;
    this.decks[i] = { idx: trackIdx, start: startMs, tr, stepDur, next: Math.max(0, Math.ceil((Date.now() - startMs) / 1000 / stepDur)) };
    this.setLevel();
  }
  setXf(x) { x = Math.min(1, Math.max(0, +x || 0)); if (Math.abs(x - this.xf) > 0.001) { this.xf = x; this.setLevel(); } }
  stop() { this.decks = [null, null]; this.setLevel(); }
  nextBar(i, fromMs) { const d = this.decks[i]; if (!d) return fromMs; const bar = d.stepDur * 16 * 1000; return d.start + Math.ceil((fromMs - d.start) / bar) * bar; }
  wallToAudio(ms) { return this.ctx.currentTime + (ms - Date.now()) / 1000; }
  tick() { if (!this.ctx) return; for (let i = 0; i < 2; i++) this.tickDeck(i); }
  tickDeck(di) {
    const c = this.decks[di]; if (!c) return;
    const ahead = Date.now() + 140;
    let guard = 0;
    while (guard++ < 32) {
      const n = c.next; const bar = Math.floor(n / 16), st = n % 16;
      const swingOff = (st % 2 === 1) ? (c.tr.swing - 0.5) * 2 * c.stepDur : 0;
      const tMs = c.start + (n * c.stepDur + swingOff) * 1000;
      if (tMs > ahead) break;
      c.next++;
      if (tMs < Date.now() - 30) continue;
      this.step(c.tr, bar, st, Math.max(this.ctx.currentTime, this.wallToAudio(tMs)), c.stepDur, this.deckGain[di]);
    }
  }
  env(g, t, a, peak, d, sus = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d); }
  step(tr, bar, st, t, sd, out) {
    const c = this.ctx;
    if (tr.kick.includes(st)) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); this.env(g, t, 0.003, 0.9, 0.32); o.connect(g).connect(out); o.start(t); o.stop(t + 0.4); }
    const noiseHit = (dur, type, f, vol, q = 1, toDelay = false) => { const s = c.createBufferSource(); s.buffer = this.noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); this.env(g, t, 0.002, vol, dur); s.connect(fl).connect(g).connect(out); if (toDelay) g.connect(this.delay); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); };
    if (tr.snare?.includes(st)) { noiseHit(0.18, 'bandpass', 1800, 0.35, 0.8, !!tr.delay); const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 190; this.env(g, t, 0.002, 0.25, 0.08); o.connect(g).connect(out); o.start(t); o.stop(t + 0.15); }
    if (tr.clap?.includes(st)) { for (let k = 0; k < 3; k++) { const tt = t + k * 0.011; const s = c.createBufferSource(); s.buffer = this.noise; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1300; const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.3, tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + (k === 2 ? 0.16 : 0.02)); s.connect(fl).connect(g).connect(out); s.start(tt, Math.random()); s.stop(tt + 0.2); } }
    if (tr.rim?.includes(st)) { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 1700; this.env(g, t, 0.001, 0.12, 0.04); o.connect(g).connect(out); if (tr.delay) g.connect(this.delay); o.start(t); o.stop(t + 0.08); }
    if (tr.hat.includes(st)) { const open = tr.hatOpen && st % 4 === 2; noiseHit(open ? 0.16 : 0.035, 'highpass', 8000, tr.hatVol * (st % 4 === 0 ? 0.7 : 1)); }
    for (const [bs, note] of tr.bass) if (bs === st) {
      const o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); const f = mtof(note);
      o.type = tr.bassType === 'acid' || tr.bassType === 'saw' ? 'sawtooth' : tr.bassType === 'square' ? 'square' : 'sine'; o.frequency.value = f;
      fl.type = 'lowpass'; const cut = tr.bassType === 'acid' ? 300 + 1500 * (0.5 + 0.5 * Math.sin((bar * 16 + st) / 20)) : tr.bassType === 'sine' ? 900 : 700;
      fl.frequency.setValueAtTime(cut * 2.2, t); fl.frequency.exponentialRampToValueAtTime(cut, t + 0.12); fl.Q.value = tr.bassType === 'acid' ? 12 : 2;
      const len = tr.bassType === 'sine' ? sd * 3.5 : sd * 1.6; this.env(g, t, 0.005, tr.bassType === 'sine' ? 0.5 : 0.22, len);
      o.connect(fl).connect(g).connect(out); o.start(t); o.stop(t + len + 0.1);
    }
    if (tr.chords.length && tr.chordSteps.includes(st)) {
      const ch = tr.chords[bar % tr.chords.length]; const len = tr.chordLen * sd; const kind = tr.pad;
      for (const m of ch) {
        const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
        o.type = kind === 'rhodes' ? 'triangle' : kind === 'pad' || kind === 'strings' ? 'sawtooth' : kind === 'clav' ? 'square' : kind === 'pluck' ? 'triangle' : 'sawtooth';
        o.frequency.value = mtof(m); o.detune.value = (Math.random() - 0.5) * 12;
        fl.type = 'lowpass'; fl.frequency.value = tr.cut;
        const vol = kind === 'pad' ? 0.05 : kind === 'strings' ? 0.04 : kind === 'rhodes' ? 0.07 : kind === 'clav' ? 0.035 : 0.06;
        const att = kind === 'pad' || kind === 'strings' ? Math.min(1.2, len * 0.3) : 0.005;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.setValueAtTime(vol, t + Math.max(att, len * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + len + (kind === 'pad' ? 1.5 : 0.25));
        o.connect(fl).connect(g).connect(out); if (tr.delay || kind === 'skank') g.connect(this.delay);
        o.start(t); o.stop(t + len + 1.8);
      }
    }
    if (tr.bells && st % 4 === 0) { const scale = [72, 74, 76, 79, 81, 84]; const m = scale[(bar * 7 + st * 3) % scale.length]; if ((bar + st) % 3 !== 1) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = mtof(m); this.env(g, t, 0.01, 0.06, 2.2); o.connect(g).connect(out); g.connect(this.delay); o.start(t); o.stop(t + 2.5); } }
  }
  pad(id) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + 0.01, out = this.master;
    if (id === 'horn') for (const f of [440, 554, 659]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.94, t + 0.7); this.env(g, t, 0.01, 0.08, 0.75); o.connect(g).connect(out); g.connect(this.delay); o.start(t); o.stop(t + 0.9); }
    if (id === 'siren') { const o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain(); o.frequency.value = 800; l.frequency.value = 4; lg.gain.value = 300; l.connect(lg).connect(o.frequency); this.env(g, t, 0.02, 0.07, 1.4); o.connect(g).connect(out); o.start(t); l.start(t); o.stop(t + 1.5); l.stop(t + 1.5); }
    if (id === 'scratch') { for (let k = 0; k < 3; k++) { const tt = t + k * 0.12; const s = c.createBufferSource(); s.buffer = this.noise; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(k % 2 ? 2400 : 600, tt); fl.frequency.exponentialRampToValueAtTime(k % 2 ? 600 : 2400, tt + 0.1); const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.5, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.11); s.connect(fl).connect(g).connect(out); s.start(tt, Math.random()); s.stop(tt + 0.12); } }
    if (id === 'clap') { for (let k = 0; k < 4; k++) { const tt = t + k * 0.012; const s = c.createBufferSource(); s.buffer = this.noise; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1200; const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.45, tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + (k === 3 ? 0.25 : 0.02)); s.connect(fl).connect(g).connect(out); g.connect(this.delay); s.start(tt, Math.random()); s.stop(tt + 0.3); } }
  }
}

// ------------------------------------------------------------------ main
export async function start(ctx) {
  const { THREE, scene, camera, controls, canvas, frameHooks, clip, loadAvatar, attachProp, attachHeadphones, canvasTex, coverTex, walkables, seats, npcs } = ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  injectCSS();
  const music = new Music();
  // hide the NPC selector: the console is for players
  for (const n of npcs) if (n.who === 'Male_Adult_15') n.group.visible = false;

  // platform capabilities (absent locally / for viewers who cannot connect)
  let room = null, user = null;
  const use = (name) => (window.claude && window.claude.use) ? window.claude.use(name).catch(() => null) : Promise.resolve(null);
  const roomP = use('room'), userP = use('user');
  userP.then(u => { user = u; });

  // ---------------- join screen
  const join = el('div', 'lv-join');
  join.innerHTML = `<div class="lv-jbox"><h2>Entra al Sottoportico</h2><label for="lv-nick">Il tuo nome</label><input id="lv-nick" maxlength="20" autocomplete="nickname" placeholder="Come ti chiamano?"><div class="lv-lbl">Scegli il tuo personaggio</div><div class="lv-grid" role="radiogroup" aria-label="Personaggi"></div><button class="primary lv-go">Entra nel locale</button><p class="lv-note">${window.SP_STANDALONE ? 'Per giocare insieme manda questo link ai tuoi amici: chi apre la pagina ed entra nel locale vi vede in tempo reale.' : 'Per giocare insieme, condividi questa pagina con i tuoi amici scegliendo le persone dal pulsante di condivisione: entrano con il loro account Claude e vi vedete in tempo reale. Chi la apre da un link pubblico può girare, ma da solo.'}</p></div>`;
  document.body.appendChild(join);
  const grid = join.querySelector('.lv-grid'); let chosen = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  AVATARS.forEach((n, k) => { const b = document.createElement('button'); b.className = 'lv-av'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', 'Personaggio ' + (k + 1)); b.style.backgroundPosition = `${-(k % 8) * 64}px ${-Math.floor(k / 8) * 64}px`; b.onclick = () => { chosen = n; [...grid.children].forEach(x => x.setAttribute('aria-checked', 'false')); b.setAttribute('aria-checked', 'true'); }; b.setAttribute('aria-checked', n === chosen ? 'true' : 'false'); grid.appendChild(b); });
  const nickIn = join.querySelector('#lv-nick');
  try { nickIn.value = localStorage.getItem('sp_nick') || ''; const a = localStorage.getItem('sp_av'); if (a && AVATARS.includes(a)) { chosen = a; [...grid.children].forEach((x, i) => x.setAttribute('aria-checked', AVATARS[i] === a ? 'true' : 'false')); } } catch (e) { }
  userP.then(async u => { if (!u || nickIn.value) return; try { const id = await u.id?.(); if (!id) return; const ps = await u.profiles([id]); const nm = ps?.[id]?.name; if (nm && !nickIn.value) nickIn.value = clean(nm.split(' ')[0], 20); } catch (e) { } });
  await new Promise(res => { join.querySelector('.lv-go').onclick = res; nickIn.onkeydown = e => { if (e.key === 'Enter') res(); }; });
  const nick = clean(nickIn.value, 20) || 'Ospite';
  try { localStorage.setItem('sp_nick', nick); localStorage.setItem('sp_av', chosen); } catch (e) { }
  music.init(); music.resume();
  join.remove();

  // ---------------- HUD
  const hud = el('div', 'lv-hud'); document.body.appendChild(hud);
  hud.innerHTML = `
    <div class="lv-top"><button class="lv-pill" id="lv-people" aria-expanded="false"><span class="lv-dot"></span><span id="lv-count">LIVE</span></button><button class="lv-pill" id="lv-audio" aria-pressed="false">Audio sì</button><button class="lv-pill" id="lv-exit">Esci</button></div>
    <div class="lv-plist" id="lv-plist" hidden></div>
    <div class="lv-now" id="lv-now" hidden></div>
    <div class="lv-toast" id="lv-toast" role="status" aria-live="polite"></div>
    <div class="lv-bottom">
      <div class="lv-log" id="lv-log" aria-live="polite"></div>
      <div class="lv-actions" id="lv-actions"></div>
      <form class="lv-chat" id="lv-chat"><label class="sr" for="lv-msg">Messaggio</label><input id="lv-msg" maxlength="140" placeholder="Scrivi a chi è nel locale…" autocomplete="off"><button class="primary" type="submit">Invia</button></form>
    </div>
    <div class="lv-dj" id="lv-dj" hidden>
      <div class="lv-djh"><strong>Console DJ</strong><button id="lv-djx">Scendi</button></div>
      <div class="lv-decks"><div class="lv-deck" id="lv-deck0" data-d="0"></div><div class="lv-deck" id="lv-deck1" data-d="1"></div></div>
      <label class="lv-xf"><span>Piatto 1</span><input id="lv-xf" type="range" min="0" max="100" value="0" aria-label="Crossfader tra piatto 1 e piatto 2"><span>Piatto 2</span></label>
      <div class="lv-tabs" role="tablist"><button role="tab" id="lv-tv" aria-selected="true">Vinili del locale</button><button role="tab" id="lv-ts" aria-selected="false">Spotify</button></div>
      <div id="lv-pv"><div class="lv-crate" id="lv-crate"></div></div>
      <div id="lv-ps" hidden><form class="lv-sform" id="lv-sform"><label class="sr" for="lv-sq">Cerca su Spotify</label><input id="lv-sq" placeholder="Cerca un brano su Spotify…" autocomplete="off"><button class="primary" type="submit">Cerca</button></form><div class="lv-sres" id="lv-sres"></div><div id="lv-vet"></div><p class="lv-snote" id="lv-snote">I brani Spotify non suonano dentro il gioco: chi è nel locale vede il disco sul piatto e lo ascolta dalla propria app con «Apri su Spotify».</p></div>
      <div class="lv-pads"><button data-pad="horn">Trombetta</button><button data-pad="scratch">Scratch</button><button data-pad="siren">Sirena</button><button data-pad="clap">Applauso</button></div>
    </div>`;
  document.getElementById('panel').hidden = true;
  const $ = id => document.getElementById(id);
  const toast = (t) => { const e = $('lv-toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.remove('on'), 2600); };
  $('lv-exit').onclick = () => location.reload();
  $('lv-audio').onclick = () => { music.init(); music.resume(); music.muted = !music.muted; $('lv-audio').textContent = music.muted ? 'Audio no' : 'Audio sì'; $('lv-audio').setAttribute('aria-pressed', String(music.muted)); music.setLevel(); };
  $('lv-people').onclick = () => { const p = $('lv-plist'); p.hidden = !p.hidden; $('lv-people').setAttribute('aria-expanded', String(!p.hidden)); };

  // ---------------- DJ: two turntables, crossfader, local vinyls + Spotify search
  // me.dj = { d:[deck,deck], x, at } ; deck = {k:'v', tr, at} | {k:'s', n, a, u, at}
  let target = 0; // deck that receives the next record
  const crate = $('lv-crate');
  const coverURL = i => { const t = coverTex[(i * 2 + 1) % coverTex.length]; return (t.userData.orig || t.image).toDataURL('image/jpeg', 0.8); };
  TRACKS.forEach((tr, i) => { const b = document.createElement('button'); b.className = 'lv-rec'; const im = document.createElement('img'); im.alt = ''; im.src = coverURL(i); const sp = document.createElement('span'); sp.textContent = tr.name; const sm = document.createElement('small'); sm.textContent = tr.bpm + ' bpm'; b.append(im, sp, sm); b.onclick = () => loadDeck(target, { k: 'v', tr: i }); crate.appendChild(b); });
  function djState() { return me.dj || (me.dj = { d: [null, null], x: 0, at: Date.now() }); }
  function loadDeck(i, deck) {
    music.init(); music.resume();
    const st = djState(); const other = st.d[1 - i];
    let at = Date.now() + 1500; // time to place the record on the platter
    if (deck.k === 'v' && other && other.k === 'v') at = music.nextBar(1 - i, at);
    st.d[i] = { ...deck, at }; st.at = Date.now();
    if (!other) st.x = i; // only one record: crossfader goes to it
    $('lv-xf').value = Math.round(st.x * 100);
    meAv.flashRecord(); target = 1 - i; renderDecks(); pub(true);
    toast(`Piatto ${i + 1}: ${deck.k === 'v' ? TRACKS[deck.tr].name : deck.n}`);
  }
  function renderDecks() {
    const st = me.dj || { d: [null, null] };
    for (let i = 0; i < 2; i++) {
      const el = $('lv-deck' + i), d = st.d[i]; el.classList.toggle('tgt', target === i);
      const h = document.createElement('div'); h.className = 'lv-dh'; h.textContent = `Piatto ${i + 1}`;
      const body = document.createElement('div'); body.className = 'lv-db';
      if (d) { if (d.k === 'v') { const im = document.createElement('img'); im.alt = ''; im.src = coverURL(d.tr); body.append(im); } const t = document.createElement('span'); t.textContent = d.k === 'v' ? TRACKS[d.tr].name : `${d.n} — ${d.a}`; body.append(t); if (d.k !== 'v') { const sm = document.createElement('small'); sm.textContent = d.k === 'b' ? 'Bandcamp' : 'Spotify'; body.append(sm); } }
      else { const t = document.createElement('span'); t.className = 'lv-empty'; t.textContent = 'vuoto'; body.append(t); }
      const row = document.createElement('div'); row.className = 'lv-dr';
      const sel = document.createElement('button'); sel.textContent = target === i ? 'Il prossimo disco va qui' : 'Carica qui'; sel.onclick = () => { target = i; renderDecks(); };
      row.append(sel);
      if (d) { const off = document.createElement('button'); off.textContent = 'Togli'; off.onclick = () => { const s2 = djState(); s2.d[i] = null; s2.at = Date.now(); renderDecks(); pub(true); }; row.append(off); }
      el.replaceChildren(h, body, row);
    }
  }
  $('lv-xf').oninput = (e) => { const st = djState(); st.x = +e.target.value / 100; music.setXf(st.x); pub(); };
  const tabV = $('lv-tv'), tabS = $('lv-ts');
  tabV.onclick = () => { tabV.setAttribute('aria-selected', 'true'); tabS.setAttribute('aria-selected', 'false'); $('lv-pv').hidden = false; $('lv-ps').hidden = true; };
  tabS.onclick = () => { tabS.setAttribute('aria-selected', 'true'); tabV.setAttribute('aria-selected', 'false'); $('lv-pv').hidden = true; $('lv-ps').hidden = false; };
  function vetrina() {
    const list = window.SP_ALBUMS || []; if (!list.length) return; const v = $('lv-vet'); const h = document.createElement('div'); h.className = 'lv-vh'; h.textContent = 'Dalla vetrina del negozio';
    const g = document.createElement('div'); g.className = 'lv-vg';
    for (const al of list) { const b = document.createElement('button'); b.className = 'lv-va'; b.title = `${al.n} — ${al.a}`; const im = document.createElement('img'); im.alt = ''; im.loading = 'lazy'; im.src = 'https://i.scdn.co/image/ab67616d00004851' + al.img; const sp = document.createElement('span'); sp.textContent = al.n; b.append(im, sp); b.onclick = () => loadDeck(target, { k: 's', n: al.n, a: al.a, u: 'https://open.spotify.com/album/' + al.id }); g.appendChild(b); }
    v.replaceChildren(h, g);
  }
  let mcp = null; const mcpP = use('mcp').then(m => { mcp = m; if (!m) { if (window.SP_STANDALONE) { $('lv-sq').placeholder = 'Link Spotify o Bandcamp'; $('lv-sform').querySelector('button').textContent = 'Metti'; $('lv-sres').textContent = 'Spotify: Condividi › Copia link (brano o album). Bandcamp: copia il link della pagina del brano o dell’album. Poi incollalo qui.'; $('lv-ts').textContent = 'Spotify · Bandcamp'; $('lv-snote').textContent = 'Il disco sul piatto suona per tutti nel locale, in filodiffusione.'; vetrina(); } else $('lv-sres').textContent = 'Per cercare su Spotify serve il connettore Spotify collegato al tuo account Claude.'; } });
  const spTrackId = u => { const m = String(u || '').match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{10,30})/); return m ? m[1] : ''; };
  const spLink = u => { const m = String(u || '').match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album)\/([A-Za-z0-9]{10,30})/); return m ? { type: m[1], id: m[2] } : null; };
  async function spFromLink(q) {
    const L = spLink(q); if (!L) return null; const url = `https://open.spotify.com/${L.type}/${L.id}`;
    let n = L.type === 'album' ? 'Album Spotify' : 'Brano Spotify', a = '';
    try { const r = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(url)); if (r.ok) { const j = await r.json(); n = clean(j.title, 60) || n; a = clean(j.author_name || '', 60); } } catch (e) { }
    return { n, a, u: url };
  }
  const bcFromEmbed = q => { const m = String(q).match(/EmbeddedPlayer\/(?:[^"'\s]*?\/)?(track|album)=(\d{1,15})/); return m ? { t: m[1], id: m[2] } : null; };
  async function bcFromLink(q) {
    const e = bcFromEmbed(q); if (e) { const tm = String(q).match(/<a href="(https:\/\/[a-z0-9-]+\.bandcamp\.com\/[^"]+)">([^<]{1,120})<\/a>/i); const nm = tm ? tm[2].split(' by ') : []; return { k: 'b', t: e.t, id: e.id, n: clean(nm[0] || 'Bandcamp', 60), a: clean(nm[1] || '', 60), u: tm ? tm[1].split('?')[0] : '' }; }
    const m = String(q).match(/https:\/\/[a-z0-9-]+\.bandcamp\.com\/(track|album)\/[A-Za-z0-9-]+/i); if (!m) return null;
    try { const r = await fetch('/api/bc?url=' + encodeURIComponent(m[0])); if (!r.ok) return 'nofn'; const j = await r.json(); if (!j.id || !/^(track|album)$/.test(j.type)) return 'nofn'; return { k: 'b', t: j.type, id: String(j.id), n: clean(j.title, 60) || 'Bandcamp', a: clean(j.artist, 60), u: m[0] }; } catch (err) { return 'nofn'; }
  }
  const bcURL = u => (typeof u === 'string' && /^https:\/\/[a-z0-9-]+\.bandcamp\.com\/(track|album)\/[A-Za-z0-9-]+$/i.test(u)) ? u : '';
  const bcOK = d => d && d.k === 'b' && /^(track|album)$/.test(d.t) && /^\d{1,15}$/.test(String(d.id));
  const spURL = u => (typeof u === 'string' && /^https:\/\/open\.spotify\.com\/(track|album)\/[A-Za-z0-9]+/.test(u)) ? u.split('?')[0] : '';
  function parseSpotify(r) {
    let p = r?.payload ?? r; const tryJ = v => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return v; } };
    p = tryJ(p); if (p?.structuredContent) p = p.structuredContent; if (Array.isArray(p?.content)) { const t = p.content.find(c => c.type === 'text')?.text; p = tryJ(t) || p; }
    const ents = Array.isArray(p?.entities) ? p.entities : [];
    return ents.filter(e => e && (e.entity_type === 'MUSIC' || String(e.uri || '').startsWith('spotify:track'))).map(e => ({ n: clean(e.name, 60), a: clean((e.creators || []).map(c => c.name).join(', '), 60), u: spURL(e.url) })).filter(e => e.n);
  }
  $('lv-sform').onsubmit = async (e) => {
    e.preventDefault(); const q = clean($('lv-sq').value, 200); if (!q) return; await mcpP; const box = $('lv-sres');
    if (!mcp && window.SP_STANDALONE) { box.textContent = 'Leggo il link…';
      if (/bandcamp\.com/i.test(q)) { const b = await bcFromLink(q); if (b === 'nofn') { box.textContent = 'Non riesco a leggere il link Bandcamp: su Bandcamp apri Condividi › Incorpora e incolla qui il codice.'; return; } if (!b) { box.textContent = 'Non è un link a un brano o album Bandcamp.'; return; } box.textContent = ''; $('lv-sq').value = ''; loadDeck(target, b); return; }
      const t = await spFromLink(q); if (!t) { box.textContent = 'Incolla il link di un brano o album Spotify, oppure di Bandcamp.'; return; } box.textContent = ''; $('lv-sq').value = ''; loadDeck(target, { k: 's', n: t.n, a: t.a, u: t.u }); return; }
    if (!mcp) { box.textContent = 'Per cercare su Spotify serve il connettore Spotify collegato al tuo account Claude.'; return; }
    box.textContent = 'Cerco…';
    try { const r = await mcp.callTool('Spotify', 'search', { prompt: q, language: 'it-IT', limit: 8 }); const list = parseSpotify(r);
      if (!list.length) { box.textContent = 'Nessun brano trovato.'; return; }
      box.replaceChildren(...list.map(t => { const b = document.createElement('button'); b.className = 'lv-srow'; const sp = document.createElement('span'); sp.textContent = t.n; const sm = document.createElement('small'); sm.textContent = t.a; b.append(sp, sm); b.onclick = () => loadDeck(target, { k: 's', n: t.n, a: t.a, u: t.u }); return b; }));
    } catch (err) { box.textContent = 'Spotify non risponde ora (' + (err?.code || 'errore') + ').'; }
  };
  hud.querySelectorAll('[data-pad]').forEach(b => b.onclick = () => { music.init(); music.resume(); const id = b.dataset.pad; music.pad(id); me.pad = { id, n: (me.pad?.n || 0) + 1, at: Date.now() }; pub(true); });
  $('lv-djx').onclick = () => standUp();

  // ---------------- avatars
  const gender = n => n.startsWith('Female') ? 'f' : 'm';
  const ANIM = { idle: '_idle_neutral_01', walk: '_walk_neutral_01', drink: '_drink_drinking', hold: '_drink_idle', sitChair: '_sit_chair_idle_relaxed_01', sitTable: '_sit_table_idle_relaxed_01', dj: '_work_table', dance: '_dancing_neutral', talk: '_gestic_talk_relaxed_01' };
  function tagTex(text, bubble) {
    return canvasTex(512, bubble ? 160 : 96, (g, w, h) => {
      g.font = bubble ? '500 34px "Bricolage Grotesque", sans-serif' : '700 40px "Bricolage Grotesque", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (bubble) {
        const words = text.split(/\s+/); const lines = []; let line = '';
        for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > 460 && line) { lines.push(line); line = wd; } else line = t; } if (line) lines.push(line);
        const L = lines.slice(0, 3); const bw = Math.min(500, Math.max(...L.map(l => g.measureText(l).width)) + 36), bh = L.length * 40 + 24;
        g.fillStyle = '#F2EADA'; roundRect(g, (w - bw) / 2, 4, bw, bh, 18); g.fill(); g.beginPath(); g.moveTo(w / 2 - 12, bh + 4); g.lineTo(w / 2, bh + 22); g.lineTo(w / 2 + 12, bh + 4); g.fill();
        g.fillStyle = '#161616'; L.forEach((l, i) => g.fillText(l, w / 2, 4 + 12 + 20 + i * 40));
      } else {
        const tw = g.measureText(text).width + 36; g.fillStyle = 'rgba(18,18,22,0.78)'; roundRect(g, (w - tw) / 2, 18, tw, 60, 30); g.fill(); g.fillStyle = '#EEA640'; g.fillText(text, w / 2, 49);
      }
    });
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  class Avatar {
    constructor(av, nick, isMe) { this.av = av; this.nick = nick; this.isMe = isMe; this.g = new THREE.Group(); scene.add(this.g); this.key = ''; this.actions = {}; this.hold = ''; this.ready = false; this.bubbleT = 0; }
    async load() {
      this.fbx = await loadAvatar(this.av); this.fbx.scale.setScalar(0.01); this.g.add(this.fbx);
      this.mixer = new THREE.AnimationMixer(this.fbx);
      this.props = { can: attachProp(this.fbx, 'R', 'can'), cup: attachProp(this.fbx, 'R', 'cup') }; this.props.can.visible = this.props.cup.visible = false;
      this.hp = attachHeadphones(this.fbx); this.hp.visible = false;
      this.rec = attachProp(this.fbx, 'L', 'record'); this.rec.visible = false; this.recT = 0;
      this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex(this.nick), depthTest: false, transparent: true })); this.tag.scale.set(1.5, 0.28, 1); this.tag.position.y = 2.05; this.tag.renderOrder = 10; this.g.add(this.tag);
      this.ready = true; await this.play('idle');
    }
    async play(key) {
      if (!this.ready || this.key === key) return; this.key = key;
      const name = gender(this.av) + ANIM[key];
      if (!this.actions[key]) { const c = await clip(name).catch(() => null); if (!c) return; const a = this.mixer.clipAction(c); a.setLoop(key === 'walk' || key === 'dance' ? THREE.LoopRepeat : THREE.LoopPingPong); this.actions[key] = a; if (key === 'walk') a.timeScale = 1.05; }
      if (this.key !== key) return;
      const a = this.actions[key]; if (!a.isRunning()) { a.reset(); a.setEffectiveWeight(Object.keys(this.actions).length === 1 ? 1 : 0); a.play(); }
      this.hp.visible = key === 'dj';
    }
    flashRecord() { if (this.rec) { this.rec.visible = true; this.recT = 1.5; } }
    setHold(h) { if (!this.ready || this.hold === h) return; this.hold = h; this.props.can.visible = h === 'can'; this.props.cup.visible = h === 'cup'; }
    say(text) { if (!this.ready) return; if (this.bubble) { this.g.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); } this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex(text, true), depthTest: false, transparent: true })); this.bubble.scale.set(2.1, 0.66, 1); this.bubble.position.y = 2.55; this.bubble.renderOrder = 11; this.g.add(this.bubble); this.bubbleT = 7; }
    update(dt) { if (!this.ready) return; if (this.recT > 0) { this.recT -= dt; if (this.recT <= 0) this.rec.visible = false; }
      if (this.actions[this.key]?.isRunning()) for (const k in this.actions) { const a = this.actions[k], tgt = k === this.key ? 1 : 0; let w = a.getEffectiveWeight(); w += (tgt - w) * Math.min(1, dt * 7); if (tgt === 0 && w < 0.02) { if (a.isRunning()) a.stop(); continue; } a.setEffectiveWeight(w); }
      this.mixer.update(dt); if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0 && this.bubble) { this.g.remove(this.bubble); this.bubble = null; } } }
    dispose() { scene.remove(this.g); this.g.traverse(o => { if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); } }); }
  }

  // ---------------- local player
  const me = { pos: V(6.2 + (Math.random() - 0.5) * 2, 0, 17.5 + Math.random() * 2), yaw: Math.PI, path: [], st: 'idle', seat: -1, hold: '', say: null, dj: null, pad: null, drinkT: 0, talkT: 0, pending: null };
  const meAv = new Avatar(chosen, nick, true); await meAv.load();
  meAv.g.position.copy(me.pos); meAv.g.rotation.y = me.yaw;

  // camera: third person
  controls.enabled = true; controls.enablePan = false; controls.rotateSpeed = 0.7; controls.minDistance = 1.8; controls.maxDistance = 10; controls.minPolarAngle = Math.PI * 0.15; controls.maxPolarAngle = Math.PI * 0.47;
  controls.target.copy(me.pos).add(V(0, 1.4, 0)); camera.position.copy(me.pos).add(V(0, 3.2, -4.8).applyAxisAngle(V(0, 1, 0), 0)); camera.position.set(me.pos.x, 3.4, me.pos.z + 5); controls.update();

  // records on the console turntables (deck 1 at x 2.15, deck 2 at x 3.05)
  const deckDisc = [2.15, 3.05].map(x => { const g = new THREE.Group(); g.position.set(x, 0.947, 2.95); scene.add(g);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.004, 48), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.28, metalness: 0.1 })); g.add(disc);
    const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.005, 32), new THREE.MeshStandardMaterial({ color: 0xEEA640 })); g.add(lbl);
    g.visible = false; return { g, lbl, spin: false }; });
  // hotspots
  const consoleSpot = { x: 2.6, z: 3.5, ry: Math.PI };
  const hot = [
    { id: 'fridge', x: 9.3, z: 5.35, r: 1.4, label: 'Frigo · lattine', act: 'Prendi una lattina' },
    { id: 'tap', x: 9.6, z: 6.95, r: 1.3, label: 'Spina', act: 'Birra alla spina' },
    { id: 'console', x: consoleSpot.x, z: consoleSpot.z, r: 1.3, label: 'Console DJ', act: 'Vai in console' },
  ];
  seats.forEach((s, i) => { const side = s.kind === 'table'; const ax = side ? Math.sin(s.ry + Math.PI / 2) * 0.55 : Math.sin(s.ry) * 0.62, az = side ? Math.cos(s.ry + Math.PI / 2) * 0.55 : Math.cos(s.ry) * 0.62; hot.push({ id: 'seat' + i, seat: i, x: s.x + ax, z: s.z + az, r: 1.0, act: 'Siediti' }); });
  const markers = [];
  for (const h of hot) if (h.label) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex(h.label), depthTest: true, transparent: true })); sp.scale.set(1.1, 0.21, 1); sp.position.set(h.x, 2.35, h.z); sp.userData.hot = h; scene.add(sp); markers.push(sp); }
  // seat rings
  const ringM = new THREE.MeshBasicMaterial({ color: 0xEEA640, transparent: true, opacity: 0.5, depthWrite: false });
  for (const s of seats) { const r = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 32), ringM); r.rotation.x = -Math.PI / 2; r.position.set(s.x, 0.02, s.z); r.userData.hot = hot.find(h => h.seat === seats.indexOf(s)); scene.add(r); markers.push(r); }

  // ---------------- navigation
  const region = v => (v.x > 0 && v.x < 11 && v.z > 0 && v.z < 10) ? 'in' : (v.x > 11 && v.z < 10.3) ? 'cor' : 'out';
  // occupancy grid (0.2 m) built from the scene's obstacles, inflated by the body radius
  const NAV = { x0: -18, z0: -2.5, res: 0.2, w: 250, h: 460 };
  const navGrid = new Uint8Array(NAV.w * NAV.h);
  const walkArea = (x, z) => (x > 0.05 && x < 10.95 && z > 0.05 && z < 9.95) || (x > -9.1 && x < 15 && z >= 9.9 && z < 15.05) || (x > 10.9 && x < 14.75 && z > -2 && z < 15) || (x > -16.9 && x < 30.9 && z >= 14.8 && z < 88.5);
  const R = 0.28;
  for (let j = 0; j < NAV.h; j++) for (let i = 0; i < NAV.w; i++) { const x = NAV.x0 + (i + 0.5) * NAV.res, z = NAV.z0 + (j + 0.5) * NAV.res; if (!walkArea(x, z)) navGrid[j * NAV.w + i] = 1; }
  const obs = (ctx.obstacles || []).filter(o => !(o.t === 'c' && Math.abs(o.x - 2.6) < 0.05 && Math.abs(o.z - 3.45) < 0.05)); // the hidden NPC at the console
  for (const o of obs) {
    const x0 = (o.t === 'b' ? o.x0 : o.x - o.r) - R, x1 = (o.t === 'b' ? o.x1 : o.x + o.r) + R, z0 = (o.t === 'b' ? o.z0 : o.z - o.r) - R, z1 = (o.t === 'b' ? o.z1 : o.z + o.r) + R;
    const i0 = Math.max(0, Math.floor((x0 - NAV.x0) / NAV.res)), i1 = Math.min(NAV.w - 1, Math.floor((x1 - NAV.x0) / NAV.res)), j0 = Math.max(0, Math.floor((z0 - NAV.z0) / NAV.res)), j1 = Math.min(NAV.h - 1, Math.floor((z1 - NAV.z0) / NAV.res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = NAV.x0 + (i + 0.5) * NAV.res, z = NAV.z0 + (j + 0.5) * NAV.res; let hit;
      if (o.t === 'b') { const dx = Math.max(o.x0 - x, 0, x - o.x1), dz = Math.max(o.z0 - z, 0, z - o.z1); hit = dx * dx + dz * dz <= R * R; } else hit = Math.hypot(x - o.x, z - o.z) <= o.r + R;
      if (hit) navGrid[j * NAV.w + i] = 1; }
  }
  const cellOf = v => [Math.floor((v.x - NAV.x0) / NAV.res), Math.floor((v.z - NAV.z0) / NAV.res)];
  const free = (i, j) => i >= 0 && j >= 0 && i < NAV.w && j < NAV.h && !navGrid[j * NAV.w + i];
  const center = (i, j) => V(NAV.x0 + (i + 0.5) * NAV.res, 0, NAV.z0 + (j + 0.5) * NAV.res);
  function nearestFree(i, j, maxR = 40) { if (free(i, j)) return [i, j]; for (let r = 1; r <= maxR; r++) { let best = null, bd = 1e9; for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; if (free(i + di, j + dj)) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = [i + di, j + dj]; } } } if (best) return best; } return null; }
  function lineFree(a, b) { const d = a.distanceTo(b), n = Math.ceil(d / (NAV.res * 0.5)); for (let k = 0; k <= n; k++) { const t = k / Math.max(1, n); const [i, j] = cellOf(V(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t)); if (!free(i, j)) return false; } return true; }
  function astar(s, g) {
    const W = NAV.w, N = W * NAV.h, start = s[1] * W + s[0], goal = g[1] * W + g[0];
    const gS = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [], push = (f, n) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hfn = n => { const dx = Math.abs((n % W) - g[0]), dz = Math.abs(((n / W) | 0) - g[1]); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    gS[start] = 0; push(hfn(start), start); let it = 0;
    while (heap.length && it++ < 120000) {
      const [, n] = pop(); if (n === goal) break; if (closed[n]) continue; closed[n] = 1;
      const ci = n % W, cj = (n / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (!free(ni, nj)) continue; if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
        const m = nj * W + ni, c = gS[n] + (di && dj ? Math.SQRT2 : 1); if (c < gS[m]) { gS[m] = c; came[m] = n; push(c + hfn(m), m); } }
    }
    if (came[goal] === -1 && goal !== start) return null;
    const cells = []; for (let n = goal; n !== -1; n = came[n]) { cells.push(center(n % W, (n / W) | 0)); if (n === start) break; } return cells.reverse();
  }
  function findPath(from, to) {
    let s = cellOf(from), g = cellOf(to); s = nearestFree(s[0], s[1]); g = nearestFree(g[0], g[1]); if (!s || !g) return null;
    const goalPt = free(...cellOf(to)) ? to.clone() : center(g[0], g[1]);
    const raw = astar(s, g); if (!raw) return null; raw[raw.length - 1] = goalPt;
    const out = []; let anchor = from.clone(), k = 0; // string pulling
    while (k < raw.length) { let far = k; for (let m = raw.length - 1; m > k; m--) if (lineFree(anchor, raw[m])) { far = m; break; } out.push(raw[far]); anchor = raw[far]; k = far + 1; }
    return out;
  }
  window.__nav = { ascii: (x0, z0, x1, z1) => { let out = ''; for (let z = z0; z <= z1; z += NAV.res) { let row = ''; for (let x = x0; x <= x1; x += NAV.res) row += free(...cellOf(V(x, 0, z))) ? '.' : '#'; out += z.toFixed(1).padStart(5) + ' ' + row + '\n'; } return out; }, free: (x, z) => free(...cellOf(V(x, 0, z))), findPath: (a, b) => findPath(V(a[0], 0, a[1]), V(b[0], 0, b[1]))?.map(p => [+p.x.toFixed(2), +p.z.toFixed(2)]) };
  function walkTo(v, then = null) { if (me.st === 'sit' || me.st === 'dj') standUp(true); const p = findPath(me.pos.clone(), v.clone()); if (!p || !p.length) { toast('Da qui non ci si arriva'); return false; } me.path = p; me.pending = then; me.st = 'walk'; pub(); return true; }
  function standUp(silent) {
    if (me.st === 'sit') { const s = seats[me.seat]; if (s) me.pos.set(s.x + Math.sin(s.ry) * 0.6, 0, s.z + Math.cos(s.ry) * 0.6); }
    if (me.st === 'dj') me.pos.set(consoleSpot.x, 0, consoleSpot.z + 0.45);
    me.st = 'idle'; me.seat = -1; $('lv-dj').hidden = true; if (!silent) pub(true);
  }
  function occupied(i) { for (const r of remotes.values()) if (r.p?.st === 'sit' && r.p?.seat === i) return true; return false; }
  function doHot(h) {
    if (h.id === 'fridge') { me.hold = 'can'; toast('Hai preso una lattina dal frigo'); }
    else if (h.id === 'tap') { me.hold = 'cup'; toast('Birra alla spina, nel bicchiere'); }
    else if (h.id === 'console') { if ([...remotes.values()].some(r => r.p?.st === 'dj')) { toast('In console c\'è già qualcuno: aspetta il tuo turno'); return; } me.st = 'dj'; me.path = []; me.pos.set(consoleSpot.x, 0, consoleSpot.z); me.yaw = consoleSpot.ry; $('lv-dj').hidden = false; renderDecks(); toast('Sei in console: scegli un disco per il piatto 1'); }
    else if (h.seat !== undefined) { if (occupied(h.seat)) { toast('Questo posto è occupato'); return; } const s = seats[h.seat]; me.st = 'sit'; me.seat = h.seat; me.path = []; me.pos.set(s.x, 0, s.z); me.yaw = s.ry; }
    pub(true);
  }
  // tap to move
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
    if (moved > 8 || dt > 450) return;
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const mh = ray.intersectObjects(markers, false)[0];
    if (mh && mh.object.userData.hot) { const h = mh.object.userData.hot; walkTo(V(h.x, 0, h.z), h); return; }
    const hit = ray.intersectObjects(walkables, false)[0]; if (!hit) return;
    const p = hit.point; p.y = 0;
    const near = hot.find(h => Math.hypot(h.x - p.x, h.z - p.z) < 0.6);
    walkTo(p, null); showMarker(p);
    void near;
  });
  const tapRing = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.22, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })); tapRing.rotation.x = -Math.PI / 2; tapRing.visible = false; scene.add(tapRing); let tapT = 0;
  function showMarker(p) { tapRing.position.set(p.x, 0.03, p.z); tapRing.visible = true; tapT = 0.8; }

  // ---------------- actions UI
  const actionsEl = $('lv-actions'); let lastActions = '';
  function renderActions(list) {
    const sig = list.map(a => a.label).join('|'); if (sig === lastActions) return; lastActions = sig;
    actionsEl.replaceChildren(...list.map(a => { const b = document.createElement('button'); b.textContent = a.label; b.className = a.primary ? 'primary' : ''; b.onclick = a.fn; return b; }));
  }
  function currentActions() {
    const L = [];
    if (me.st === 'walk') return L;
    if (me.st === 'idle') { const h = hot.find(h => Math.hypot(h.x - me.pos.x, h.z - me.pos.z) < h.r); if (h) L.push({ label: h.act, primary: true, fn: () => doHot(h) }); }
    if (me.hold) { L.push({ label: 'Bevi', primary: !L.length, fn: () => { me.drinkT = 4.5; pub(true); } }); L.push({ label: 'Posa', fn: () => { me.hold = ''; pub(true); } }); }
    if (musicOn() && (me.st === 'idle' || me.st === 'dance')) L.push({ label: me.st === 'dance' ? 'Smetti di ballare' : 'Balla', fn: () => { me.st = me.st === 'dance' ? 'idle' : 'dance'; pub(true); } });
    if (me.st === 'sit') L.push({ label: 'Alzati', fn: () => standUp() });
    if (me.st === 'dj') L.push({ label: 'Dischi', primary: true, fn: () => { $('lv-dj').hidden = !$('lv-dj').hidden; } }, { label: 'Scendi', fn: () => standUp() });
    return L;
  }

  // ---------------- chat
  const logEl = $('lv-log');
  function addLog(who, text, mine) { const d = document.createElement('div'); d.className = 'lv-msg' + (mine ? ' me' : ''); const b = document.createElement('b'); b.textContent = who + ' '; const s = document.createElement('span'); s.textContent = text; d.append(b, s); logEl.appendChild(d); while (logEl.children.length > 6) logEl.firstChild.remove(); setTimeout(() => d.classList.add('old'), 15000); }
  $('lv-chat').onsubmit = (e) => { e.preventDefault(); const inp = $('lv-msg'); const t = clean(inp.value, 140); if (!t) return; inp.value = ''; me.say = { t, at: Date.now() }; me.talkT = 3.5; meAv.say(t); addLog(nick, t, true); pub(true); inp.blur(); };
  window.addEventListener('keydown', e => { if (e.key === 'Enter' && document.activeElement !== $('lv-msg') && !e.target.closest?.('input,textarea')) { $('lv-msg').focus(); e.preventDefault(); } });

  // ---------------- presence
  let lastPub = 0, dirty = true;
  function presenceObj() {
    let st = me.st; if (me.drinkT > 0 && (st === 'idle' || st === 'sit')) st = st === 'sit' ? 'sit' : 'drink';
    return { v: 1, n: nick, av: chosen, p: [+me.pos.x.toFixed(2), +me.pos.z.toFixed(2)], r: +me.yaw.toFixed(2), st, seat: me.seat, h: me.hold, dr: me.drinkT > 0 ? 1 : 0, tk: me.talkT > 0 ? 1 : 0, say: me.say, dj: me.dj, pad: me.pad };
  }
  function pub(force) { dirty = true; if (force) lastPub = 0; }
  function flush() { if (!room || !dirty) return; const now = performance.now(); if (now - lastPub < 120) return; lastPub = now; dirty = false; room.presence(presenceObj()).catch(() => { }); }

  // ---------------- remote players
  const remotes = new Map(); // peer -> {av:Avatar, p, pos, yaw, lastSay, lastPad}
  async function syncPeers(list) {
    const seen = new Set();
    for (const peer of list) {
      if (peer.isMe || peer.kind !== 'viewer') continue;
      const p = peer.presence || {}; if (p.v !== 1 || !AVATARS.includes(p.av) || !Array.isArray(p.p)) continue;
      seen.add(peer.peer);
      let r = remotes.get(peer.peer);
      const pn = clean(p.n, 20) || 'Ospite';
      if (!r || r.avName !== p.av || r.nick !== pn) {
        if (r) r.av.dispose();
        r = { avName: p.av, nick: pn, av: new Avatar(p.av, pn + (peer.guest ? ' ·' : ''), false), p, pos: V(+p.p[0] || 0, 0, +p.p[1] || 0), yaw: +p.r || 0, lastSay: p.say?.at || 0, lastPad: p.pad?.n || 0, joinedAt: Date.now() };
        remotes.set(peer.peer, r); r.av.load().then(() => { r.av.g.position.copy(r.pos); });
        if (Date.now() - (r.firstSeen ||= Date.now()) < 2000) toast(pn + ' è entrato nel locale');
      }
      r.p = p;
      if (p.say && typeof p.say.at === 'number' && p.say.at !== r.lastSay) { r.lastSay = p.say.at; const t = clean(p.say.t, 140); if (t && Date.now() - p.say.at < 20000) { r.av.say(t); addLog(pn, t, false); } }
      if (p.pad && typeof p.pad.n === 'number' && p.pad.n !== r.lastPad) { r.lastPad = p.pad.n; if (Date.now() - (p.pad.at || 0) < 4000 && ['horn', 'scratch', 'siren', 'clap'].includes(p.pad.id)) music.pad(p.pad.id); }
    }
    for (const [k, r] of remotes) if (!seen.has(k)) { r.av.dispose(); remotes.delete(k); toast(r.nick + ' è uscito'); }
    renderPeople();
  }
  function renderPeople() {
    const n = remotes.size + 1; $('lv-count').textContent = room ? `LIVE · ${n} ${n === 1 ? 'persona' : 'persone'}` : 'Da solo';
    const pl = $('lv-plist'); const rows = [[nick + ' (tu)', me.st]].concat([...remotes.values()].map(r => [r.nick, r.p?.st]));
    pl.replaceChildren(...rows.map(([nm, st]) => { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = nm; const s = document.createElement('span'); s.textContent = ({ dj: 'in console', sit: 'seduto', dance: 'balla', walk: 'cammina', drink: 'beve' })[st] || 'nel locale'; d.append(b, s); return d; }));
  }

  // ---------------- music state from everyone's dj field
  function musicOn() { return !!(music.decks[0] || music.decks[1] || spotifyLive); }
  let spotifyLive = false;
  let musicCheck = 0;
  function validDj(d) { return d && typeof d === 'object' && typeof d.at === 'number' && Array.isArray(d.d); }
  function resolveMusic() {
    let best = validDj(me.dj) ? { dj: me.dj, who: nick, isMe: true } : null;
    for (const r of remotes.values()) { const d = r.p?.dj; if (validDj(d) && (!best || d.at > best.dj.at)) best = { dj: d, who: r.nick, av: r.av }; }
    const now = $('lv-now'); spotifyLive = false; const bits = [];
    window.__musicLevel = (best && best.dj.d.some(Boolean)) ? 1 : 0;
    for (let i = 0; i < 2; i++) {
      const d = best?.dj.d[i]; const disc = deckDisc[i];
      if (d && d.k === 'v' && TRACKS[d.tr] && typeof d.at === 'number') { music.setDeck(i, d.tr, d.at); disc.g.visible = Date.now() > d.at - 300; disc.lbl.material.color.setHSL((d.tr * 0.13) % 1, 0.55, 0.55); disc.spin = Date.now() > d.at; }
      else if (d && (d.k === 's' || bcOK(d))) { music.setDeck(i, -1, 0); disc.g.visible = true; disc.lbl.material.color.set(d.k === 'b' ? 0x629aa9 : 0x1db954); disc.spin = true; spotifyLive = true; }
      else { music.setDeck(i, -1, 0); disc.g.visible = false; disc.spin = false; }
      if (d) bits.push({ i, d });
    }
    if (best) music.setXf(best.dj.x);
    if (!bits.length) { now.hidden = true; filo.set(null); return; }
    now.hidden = false;
    const xf = best.dj.x ?? 0; const main = bits.length === 2 ? (xf < 0.5 ? bits[0] : bits[1]) : bits[0];
    filo.set(main.d.k === 's' || bcOK(main.d) ? main.d : null);
    const sig = JSON.stringify([best.who, bits.map(b => [b.i, b.d.k, b.d.tr, b.d.n, b.d.u]), main.i]); if (now.dataset.sig === sig) return; now.dataset.sig = sig;
    const t = document.createElement('span'); t.textContent = `In console: ${best.who} · Piatto ${main.i + 1}: ${main.d.k === 'v' ? TRACKS[main.d.tr].name : clean(main.d.n, 60) + ' — ' + clean(main.d.a, 60)}`;
    const nodes = [t];
    for (const b of bits) { const u = b.d.k === 's' ? spURL(b.d.u) : b.d.k === 'b' ? bcURL(b.d.u) : ''; if (u) { const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.textContent = `Apri su ${b.d.k === 'b' ? 'Bandcamp' : 'Spotify'} (piatto ${b.i + 1})`; nodes.push(a); } }
    now.replaceChildren(...nodes);
  }
  // ---------------- filodiffusione (standalone): the deck on air plays for everyone through the Spotify / Bandcamp players
  const filo = (() => {
    if (!window.SP_STANDALONE) return { set() { } };
    const box = document.createElement('div'); box.className = 'lv-filo'; box.hidden = true;
    box.innerHTML = `<div class="lv-fh"><span class="lv-fdot"></span><b>Filodiffusione</b><span class="lv-fi" id="lv-fi"></span><button id="lv-fmin" aria-label="Riduci">–</button></div><div id="lv-fbody"><div id="lv-fp"></div><div class="lv-fr"><button id="lv-fon" class="primary">Attiva l'audio</button><a id="lv-flog" href="https://accounts.spotify.com/it/login" target="_blank" rel="noopener">Accedi a Spotify</a></div><p class="lv-fn" id="lv-fn"></p></div>`;
    hud.appendChild(box);
    let cur = null, ctrl = null, apiP = null, enabled = false, lastSeek = 0, dur = 0, pos = 0, paused = true, kind = '';
    const keyOf = d => d ? `${d.k}:${d.u || ''}:${d.t || ''}:${d.id || ''}@${d.at}` : '';
    const api = () => apiP ||= new Promise((res, rej) => { window.onSpotifyIframeApiReady = res; const sc = document.createElement('script'); sc.src = 'https://open.spotify.com/embed/iframe-api/v1'; sc.async = true; sc.onerror = rej; document.head.appendChild(sc); });
    const spUri = u => { const L = spLink(u); return L ? `spotify:${L.type}:${L.id}` : ''; };
    const expected = () => cur ? Math.max(0, (Date.now() - cur.at) / 1000) : 0;
    const isTrack = () => cur && cur.k === 's' && /\/track\//.test(cur.u);
    function seekNow() { if (!ctrl || !isTrack()) return; const t = expected(); if (dur && t > dur - 2) return; lastSeek = Date.now(); try { ctrl.seek(Math.floor(t)); } catch (e) { } }
    function start() { if (!ctrl) return; try { ctrl.play(); } catch (e) { } setTimeout(seekNow, 1200); setTimeout(() => { if (enabled && paused && kind === 's') { const b = $('lv-fon'); b.hidden = false; b.textContent = '▶ Tocca per ascoltare'; } }, 4000); }
    function onUpdate(e) { const d = e?.data || {}; dur = (d.duration || 0) / 1000; pos = (d.position || 0) / 1000; paused = !!d.isPaused; if (!paused) $('lv-fon').hidden = true;
      if (enabled && isTrack() && !paused && Date.now() - lastSeek > 6000 && Math.abs(pos - expected()) > 3 && !(dur && expected() > dur)) seekNow(); }
    async function mountSpotify(uri) {
      let IFrameAPI; try { IFrameAPI = await api(); } catch (e) { $('lv-fn').textContent = 'Il player Spotify non si carica su questa rete.'; return; }
      if (kind !== 's' || !ctrl) {
        const host = $('lv-fp'); host.replaceChildren(); const el = document.createElement('div'); host.appendChild(el); kind = 's';
        await new Promise(r => { IFrameAPI.createController(el, { uri, width: '100%', height: 80, theme: 'dark' }, c => { ctrl = c; c.addListener('playback_update', onUpdate); c.addListener('ready', () => r()); }); setTimeout(r, 5000); });
      } else ctrl.loadUri(uri);
      if (enabled) start();
    }
    function mountBandcamp(d) {
      if (ctrl) { try { ctrl.destroy(); } catch (e) { } ctrl = null; } kind = 'b';
      const f = document.createElement('iframe'); f.src = `https://bandcamp.com/EmbeddedPlayer/${d.t}=${d.id}/size=large/bgcol=121216/linkcol=eea640/tracklist=false/artwork=small/transparent=true/`; f.title = 'Player Bandcamp'; f.allow = 'autoplay'; f.className = 'lv-bc';
      $('lv-fp').replaceChildren(f);
    }
    function set(d) {
      if (d && d.k === 's' && !spURL(d.u)) d = null; if (d && d.k === 'b' && !bcOK(d)) d = null;
      if (keyOf(d) === keyOf(cur)) return; cur = d ? { ...d } : null;
      box.hidden = !d; if (!d) { if (ctrl) try { ctrl.pause(); } catch (e) { } return; }
      $('lv-fi').textContent = clean(d.n, 60) + (d.a ? ' — ' + clean(d.a, 60) : '');
      $('lv-flog').hidden = d.k !== 's';
      if (d.k === 's') { $('lv-fn').textContent = enabled ? 'Senza accesso a Spotify in questo browser si sentono solo 30 secondi: accedi per ascoltare i brani interi.' : 'Tocca «Attiva l’audio» per sentire quello che suona in console.'; mountSpotify(spUri(d.u)); }
      else { mountBandcamp(d); $('lv-fon').hidden = true; $('lv-fn').textContent = 'Bandcamp: premi ▶ nel player. Si ascolta gratis, senza account.'; }
    }
    $('lv-fon').onclick = () => { enabled = true; music.init(); music.resume(); $('lv-fon').hidden = true; if (cur?.k === 's') { $('lv-fn').textContent = 'Senza accesso a Spotify in questo browser si sentono solo 30 secondi: accedi per ascoltare i brani interi.'; start(); } };
    $('lv-fmin').onclick = () => { const b = $('lv-fbody'); b.hidden = !b.hidden; $('lv-fmin').textContent = b.hidden ? '+' : '–'; };
    return { set };
  })();
  let lastDjAt = {};
  function watchRemoteDecks() { for (const [k, r] of remotes) { const d = r.p?.dj; if (validDj(d)) { const sig = d.d.map(x => x?.at || 0).join(','); if (lastDjAt[k] && lastDjAt[k] !== sig) r.av.flashRecord?.(); lastDjAt[k] = sig; } } }

  // ---------------- room connect
  roomP.then(r => {
    room = r; renderPeople();
    if (!room) { toast(window.SP_STANDALONE ? 'Stanza dal vivo non raggiungibile: giochi da solo' : 'Sei da solo: condividi la pagina con i tuoi amici per giocare insieme'); return; }
    room.onPeers(ch => syncPeers(ch.peers), () => { toast('Connessione live non disponibile'); });
    pub(true);
  });
  renderPeople();

  // ---------------- per-frame
  const fwd = V(), tmp = V();
  frameHooks.push(dt => {
    // local movement
    if (me.path.length) {
      const tgt = me.path[0]; tmp.subVectors(tgt, me.pos); tmp.y = 0; const d = tmp.length();
      const step = 1.45 * dt;
      if (d <= step) { me.pos.copy(tgt); me.path.shift(); if (!me.path.length) { me.st = 'idle'; if (me.pending) { const h = me.pending; me.pending = null; doHot(h); } pub(true); } }
      else { tmp.multiplyScalar(1 / d); me.pos.addScaledVector(tmp, step); const ty = Math.atan2(tmp.x, tmp.z); let dy = ty - me.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); me.yaw += dy * Math.min(1, dt * 10); pub(); }
    }
    if (me.drinkT > 0) { me.drinkT -= dt; if (me.drinkT <= 0) pub(true); }
    if (me.talkT > 0) { me.talkT -= dt; if (me.talkT <= 0) pub(true); }
    meAv.g.position.copy(me.pos); meAv.g.rotation.y = me.yaw;
    meAv.play(animKey(me.st, me.seat, me.drinkT > 0, me.talkT > 0, !!me.hold)); meAv.setHold(me.hold); meAv.update(dt);
    // camera follow
    const t = me.pos.clone().add(V(0, me.st === 'sit' ? 1.0 : 1.45, 0)); const delta = t.clone().sub(controls.target); camera.position.add(delta); controls.target.copy(t);
    { // keep the camera inside the room / under the portico ceiling
      const rg = region(me.pos), cp = camera.position;
      if (rg === 'in') {
        controls.maxDistance = 4.2;
        const inside = cp.x > 0.3 && cp.x < 10.7 && cp.z > 0.3 && cp.z < 9.7 && cp.y < 2.9 && !(cp.x < 5.2 && cp.z < 2.5);
        if (!inside) { // swing the camera to the room side of the player, looking toward the walls
          const c = V(5.6, 0, 5.8).sub(V(me.pos.x, 0, me.pos.z)); if (c.lengthSq() < 0.01) c.set(0, 0, 1); c.normalize();
          const want = V(me.pos.x + c.x * 2.9, 2.55, me.pos.z + c.z * 2.9); cp.lerp(want, 0.35);
          cp.x = Math.min(10.7, Math.max(0.3, cp.x)); cp.z = Math.min(9.7, Math.max(0.3, cp.z)); cp.y = Math.min(2.85, cp.y);
        }
      }
      else if (rg === 'cor' || me.pos.z < 15.2) { controls.maxDistance = 6; cp.y = Math.min(3.2, cp.y); if (rg !== 'cor' && cp.z < 10.3 && cp.x < 11) cp.z = 10.3; }
      else controls.maxDistance = 10;
      const off = cp.clone().sub(controls.target), d = off.length(); if (d > controls.maxDistance) cp.copy(controls.target).addScaledVector(off, controls.maxDistance / d);
    }
    // remotes
    for (const r of remotes.values()) {
      const p = r.p || {}; const goal = V(+p.p?.[0] || 0, 0, +p.p?.[1] || 0);
      const dist = r.pos.distanceTo(goal);
      if (dist > 6) r.pos.copy(goal); else r.pos.lerp(goal, Math.min(1, dt * 6));
      let dy = (+p.r || 0) - r.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.yaw += dy * Math.min(1, dt * 8);
      const moving = dist > 0.05 || p.st === 'walk';
      r.av.g.position.copy(r.pos); r.av.g.rotation.y = r.yaw;
      r.av.play(moving && p.st !== 'sit' && p.st !== 'dj' ? 'walk' : animKey(p.st, p.seat, !!p.dr, !!p.tk, !!p.h)); r.av.setHold(['can', 'cup'].includes(p.h) ? p.h : ''); r.av.update(dt);
    }
    // marker pulse, tap ring
    if (tapT > 0) { tapT -= dt; tapRing.material.opacity = Math.max(0, tapT); tapRing.scale.setScalar(1 + (0.8 - tapT)); if (tapT <= 0) tapRing.visible = false; }
    ringM.opacity = 0.35 + 0.2 * Math.sin(performance.now() / 300);
    for (const m of markers) if (m.isSprite) { const h = m.userData.hot; m.visible = Math.hypot(h.x - me.pos.x, h.z - me.pos.z) > h.r + 0.8; }
    // audio space: louder inside the shop
    const reg = region(me.pos); const dd = Math.hypot(me.pos.x - 6.2, me.pos.z - 10);
    const sp = reg === 'in' ? 1 : reg === 'cor' ? 0.5 : Math.max(0.12, 0.75 - (dd - 1) * 0.06);
    if (Math.abs(sp - music.space) > 0.03) { music.space = sp; music.setLevel(); }
    musicCheck -= dt; if (musicCheck <= 0) { musicCheck = 0.4; resolveMusic(); watchRemoteDecks(); renderPeople(); }
    for (const d of deckDisc) if (d.g.visible && d.spin) d.g.rotation.y -= dt * 3.49;
    renderActions(currentActions());
    flush();
  });
  function animKey(st, seat, drinking, talking, holding) {
    if (st === 'walk') return 'walk';
    if (st === 'sit') return seats[seat]?.kind === 'table' ? 'sitTable' : 'sitChair';
    if (st === 'dj') return 'dj';
    if (st === 'dance') return 'dance';
    if (drinking || st === 'drink') return 'drink';
    if (talking) return 'talk';
    return holding ? 'hold' : 'idle';
  }
  window.__live = { me, meAv, remotes, loadDeck: (i, tr) => loadDeck(i, { k: 'v', tr }), loadSp: (i, n, a, u) => loadDeck(i, { k: 's', n, a, u }), xf: x => { const st = djState(); st.x = x; music.setXf(x); pub(true); }, walkTo: (x, z) => walkTo(V(x, 0, z)), doHot: id => doHot(hot.find(h => h.id === id)), say: t => { $('lv-msg').value = t; $('lv-chat').requestSubmit(); }, dj: i => loadDeck(target, { k: 'v', tr: i }), pad: id => hud.querySelector(`[data-pad="${id}"]`).click(), sit: i => doHot(hot.find(h => h.seat === i)) };
  toast('Tocca il pavimento per camminare');
}

function el(tag, cls) { const e = document.createElement(tag); e.className = cls; return e; }
function injectCSS() {
  const s = document.createElement('style'); s.textContent = `
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .lv-join{position:fixed;inset:0;z-index:7;background:#0e0f14ee;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
  .lv-jbox{width:min(560px,100%);display:flex;flex-direction:column;gap:10px}
  .lv-jbox h2{margin:0;font-size:30px;font-weight:800;font-stretch:78%}
  .lv-jbox label,.lv-lbl{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--amber);letter-spacing:.1em;text-transform:uppercase}
  .lv-jbox input{font:inherit;font-size:17px;padding:12px;border-radius:10px;border:1px solid #F2EADA55;background:#18181d;color:var(--paper)}
  .lv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px;max-height:42vh;overflow:auto;padding:2px}
  .lv-av{width:64px;height:64px;min-height:64px;padding:0;border-radius:10px;background-image:url(assets/avatars.jpg);background-size:512px 256px;border:2px solid transparent}
  .lv-av[aria-checked="true"]{border-color:var(--amber);box-shadow:0 0 0 2px var(--amber)}
  .lv-note{font-size:13px;line-height:1.45;color:#F2EADAcc;margin:4px 0 0}
  .lv-hud{position:fixed;inset:0;pointer-events:none;z-index:3}
  .lv-hud>*{pointer-events:auto}
  .lv-top{position:absolute;right:12px;top:56px;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
  .lv-pill{min-height:36px;font-size:13px;padding:0 12px;background:#121216d9;font-family:'IBM Plex Mono',monospace;font-weight:500;display:flex;align-items:center;gap:6px}
  .lv-dot{width:8px;height:8px;border-radius:50%;background:#e5484d;box-shadow:0 0 8px #e5484d}
  .lv-plist{position:absolute;right:12px;top:100px;background:#121216ee;border:1px solid #F2EADA33;border-radius:12px;padding:10px 12px;min-width:200px;font-size:14px;display:flex;flex-direction:column;gap:6px}
  .lv-plist[hidden]{display:none}
  .lv-plist div{display:flex;justify-content:space-between;gap:12px}.lv-plist span{color:#F2EADAaa;font-family:'IBM Plex Mono',monospace;font-size:12px}
  .lv-now{position:absolute;left:12px;top:60px;max-width:60vw;background:#4A1C26e6;border-radius:999px;padding:8px 14px;font-family:'IBM Plex Mono',monospace;font-size:12px}
  .lv-now[hidden]{display:none}
  .lv-toast{position:absolute;left:50%;top:104px;transform:translateX(-50%);background:#F2EADA;color:#161616;border-radius:999px;padding:8px 16px;font-size:14px;font-weight:600;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
  .lv-toast.on{opacity:1}
  .lv-bottom{position:absolute;left:10px;right:10px;bottom:10px;max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:8px;pointer-events:none}
  .lv-bottom>*{pointer-events:auto}
  .lv-log{display:flex;flex-direction:column;gap:4px;pointer-events:none}
  .lv-msg{align-self:flex-start;background:#121216d0;border-radius:12px;padding:6px 10px;font-size:14px;max-width:85%;transition:opacity 1s}
  .lv-msg b{color:var(--amber)}.lv-msg.me b{color:#9fd3c7}.lv-msg.old{opacity:.45}
  .lv-actions{display:flex;gap:8px;flex-wrap:wrap}
  .lv-actions button{background:#121216e0}
  .lv-actions button.primary{background:var(--amber)}
  .lv-chat{display:flex;gap:8px}
  .lv-chat input{flex:1;min-width:0;font:inherit;font-size:16px;padding:0 12px;min-height:44px;border-radius:10px;border:1px solid #F2EADA44;background:#121216e6;color:var(--paper)}
  .lv-dj{position:absolute;left:10px;right:10px;bottom:120px;top:110px;max-width:640px;margin:0 auto;background:#121216f0;border:1px solid #F2EADA33;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px;max-height:52vh;overflow:auto}
  .lv-dj[hidden]{display:none}
  .lv-djh{display:flex;justify-content:space-between;align-items:center}
  .lv-crate{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
  .lv-rec{display:grid;grid-template-columns:44px 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;text-align:left;padding:6px;min-height:56px;white-space:normal}
  .lv-rec img{grid-row:1/3;width:44px;height:44px;border-radius:4px}
  .lv-rec span{font-size:13px;line-height:1.15}.lv-rec small{font-family:'IBM Plex Mono',monospace;font-size:11px;opacity:.7;font-weight:400}
  .lv-decks{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .lv-deck{border:1px solid #F2EADA33;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;min-width:0}
  .lv-deck.tgt{border-color:var(--amber);box-shadow:0 0 0 1px var(--amber)}
  .lv-dh{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--amber);letter-spacing:.1em;text-transform:uppercase}
  .lv-db{display:flex;align-items:center;gap:8px;min-height:44px;font-size:13px;line-height:1.2}.lv-db img{width:40px;height:40px;border-radius:50%}.lv-db small{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#1db954}.lv-empty{opacity:.55}
  .lv-dr{display:flex;gap:6px;flex-wrap:wrap}.lv-dr button{min-height:36px;font-size:12px;padding:0 8px}
  .lv-xf{display:flex;align-items:center;gap:8px;font-family:'IBM Plex Mono',monospace;font-size:11px}.lv-xf input{flex:1;accent-color:#EEA640;min-height:32px}
  .lv-tabs{display:flex;gap:6px}.lv-tabs button{flex:1;min-height:38px;font-size:13px}.lv-tabs button[aria-selected="true"]{background:#F2EADA;color:#161616}
  [hidden]{display:none!important}
  .lv-sform{display:flex;gap:6px}.lv-sform input{flex:1;min-width:0;font:inherit;font-size:16px;padding:0 10px;min-height:42px;border-radius:10px;border:1px solid #F2EADA44;background:#18181d;color:var(--paper)}
  .lv-sres{display:flex;flex-direction:column;gap:6px;margin-top:8px;font-size:13px}.lv-srow{display:flex;flex-direction:column;align-items:flex-start;text-align:left;padding:6px 10px;min-height:44px;white-space:normal}.lv-srow small{opacity:.7;font-weight:400}
  .lv-snote{font-size:12px;color:#F2EADAaa;margin:8px 0 0;line-height:1.4}
  .lv-now a{color:#1db954;margin-left:10px;white-space:nowrap}
  .lv-filo{position:absolute;left:12px;top:104px;width:min(340px,calc(100vw - 24px));background:#121216f0;border:1px solid #F2EADA22;border-radius:14px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;pointer-events:auto;z-index:3}
  .lv-filo[hidden],#lv-fbody[hidden],.lv-filo [hidden]{display:none}
  .lv-fh{display:flex;align-items:center;gap:8px;font-size:12px;font-family:'IBM Plex Mono',monospace}.lv-fh b{color:#EEA640}.lv-fi{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85}
  .lv-fh button{min-height:28px;min-width:32px;padding:0}
  .lv-fdot{width:8px;height:8px;border-radius:50%;background:#e5484d;box-shadow:0 0 8px #e5484d;animation:lvblink 1.4s infinite}@keyframes lvblink{50%{opacity:.3}}
  #lv-fp iframe{border:0;border-radius:10px;width:100%;display:block}.lv-bc{height:120px}
  .lv-fr{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.lv-fr a{color:#1db954;font-size:13px}
  .lv-fn{margin:0;font-size:11.5px;opacity:.75;line-height:1.35}
  .lv-vh{font-size:12px;font-family:'IBM Plex Mono',monospace;color:#EEA640;margin:8px 0 6px}.lv-vg{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px}
  .lv-va{display:flex;flex-direction:column;gap:3px;padding:4px;min-height:0;background:#ffffff0d;border-radius:8px;text-align:left}.lv-va img{width:100%;aspect-ratio:1;border-radius:4px;display:block}.lv-va span{font-size:10.5px;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .lv-now{display:flex;align-items:center;flex-wrap:wrap;gap:4px}
  .lv-pads{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .lv-pads button{background:#4A1C26;border-color:#4A1C26;font-size:13px;padding:0 4px}
  #top{pointer-events:none}
  @media (max-width:520px){.lv-top{top:52px}.lv-now{top:96px;max-width:70vw}.lv-filo{top:140px}.lv-toast{top:140px}.lv-dj{bottom:118px}}
  `;
  document.head.appendChild(s);
}
