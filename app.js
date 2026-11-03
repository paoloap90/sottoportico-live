import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { Sky } from 'three/addons/objects/Sky.js';

const A = 'assets/';
const walkables = [], frameHooks = [], seats = [], npcs = [], obstacles = [];
const obBox = (x0, z0, x1, z1) => obstacles.push({ t: 'b', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
const obCirc = (x, z, r) => obstacles.push({ t: 'c', x, z, r });
try { await Promise.race([Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('500 40px "IBM Plex Mono"'), document.fonts.load('600 80px "Bricolage Grotesque"')]), new Promise(r => setTimeout(r, 3000))]); } catch (e) { }
const lmsg = document.getElementById('lmsg'), bar = document.querySelector('#bar i');
const isMobile = Math.min(innerWidth, innerHeight) < 600;

// ---------------- renderer / scene ----------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.25 : 1.75));
{ renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;z-index:99;background:#b3261e;color:#fff;padding:12px;border-radius:10px;font:14px system-ui'; d.textContent = 'Il telefono ha esaurito la memoria grafica. Chiudi altre app/schede e ricarica.'; document.body.appendChild(d); }); }
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 1200);

// physical sky (golden hour) — also used to light the scene
const SUN_DIR = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 3.5), THREE.MathUtils.degToRad(-58));
const sky = new Sky(); sky.scale.setScalar(600);
{ const u = sky.material.uniforms; u.turbidity.value = 9; u.rayleigh.value = 3.2; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.86; u.sunPosition.value.copy(SUN_DIR); }
scene.add(sky);
scene.fog = new THREE.Fog(0xb59a8a, 90, 420);
const manager = new THREE.LoadingManager();
{ const t0 = performance.now(), el = document.getElementById('ltime'); const dots = ['', '.', '..', '...']; let k = 0;
  const iv = setInterval(() => { if (!document.getElementById('loading')) return clearInterval(iv); el.textContent = 'Sto caricando' + dots[k++ % 4].padEnd(3, '\u00a0') + ' ' + Math.round((performance.now() - t0) / 1000) + ' s'; }, 500); }
addEventListener('error', e => { const l = document.getElementById('lmsg'); if (l && document.getElementById('loading')) l.textContent = 'Errore: ' + (e.message || e.error); });
addEventListener('unhandledrejection', e => { const l = document.getElementById('lmsg'); if (l && document.getElementById('loading')) l.textContent = 'Errore: ' + (e.reason && e.reason.message || e.reason); });
manager.onProgress = (url, loaded, total) => { bar.style.width = Math.round(loaded / total * 100) + '%'; };
const texL = new THREE.TextureLoader(manager);
const fbxL = new FBXLoader(manager);
fbxL.manager.setURLModifier(u => /\.tga$/i.test(u) ? 'data:,' : u);
const gltfL = new GLTFLoader(manager); gltfL.setMeshoptDecoder(MeshoptDecoder);

function tex(path, { srgb = true, rep = null, aniso = 8 } = {}) {
  const t = texL.load(A + path);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  t.anisotropy = aniso; return t;
}

const b64buf = async (url) => { if (/\.b64\.json$/.test(url) && window.SP_STANDALONE) return (await fetch(url.replace(/\.b64\.json$/, '.bin'))).arrayBuffer(); const j = await (await fetch(url)).json(); const bin = atob(j.b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
// environment lighting baked from the same sky
{ const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); const sk2 = new Sky(); sk2.scale.setScalar(50); Object.keys(sky.material.uniforms).forEach(k => sk2.material.uniforms[k].value = sky.material.uniforms[k].value); es.add(sk2); scene.environment = pm.fromScene(es, 0.02).texture; }

// ---------------- materials ----------------
const STD = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0, envMapIntensity: 0.12 }, o));
const mTrav = STD({ map: tex('tex/travertine.jpg', { rep: [6, 2] }), roughness: 0.55 });
const mTravC = STD({ map: tex('tex/travertine.jpg', { rep: [2, 8] }), roughness: 0.55 });
const mTravStreet = STD({ map: tex('tex/travertine.jpg', { rep: [14, 10] }), roughness: 0.6, color: 0xaea79b });
const mWood = STD({ map: tex('tex/hardwood2_diffuse.jpg', { rep: [5, 5] }), roughnessMap: tex('tex/hardwood2_roughness.jpg', { srgb: false, rep: [5, 5] }), bumpMap: tex('tex/hardwood2_bump.jpg', { srgb: false, rep: [5, 5] }), bumpScale: 0.6, roughness: 0.75, color: 0xb59a7c });
const mOak = STD({ map: tex('tex/hardwood2_diffuse.jpg', { rep: [1, 1] }), roughness: 0.5, color: 0xd9b48a });
const mPlaster = STD({ color: 0xd9d2c6, roughness: 0.95 });
const mPlasterWarm = STD({ color: 0xdcd0bc, roughness: 0.95 });
const mConcrete = STD({ map: tex('tex/concrete.jpg', { rep: [1, 1] }), roughness: 0.92 });
const mColumn = STD({ map: tex('tex/concrete.jpg', { rep: [1, 3] }), roughness: 0.9, color: 0xd8d2c8 });
const brushed = tex('tex/brushed.jpg', { srgb: false, rep: [1, 1] });
const mSteel = STD({ color: 0xc9ccd0, metalness: 0.9, roughness: 0.32, roughnessMap: brushed, envMapIntensity: 1.0 });
const mBlackMetal = STD({ color: 0x1c1c1e, metalness: 0.6, roughness: 0.45 });
const mBord = STD({ color: 0x4a1a24, roughness: 0.55, metalness: 0.15 });
const mFelt = STD({ color: 0x5a1f2c, roughness: 1 });
const mGlass = new THREE.MeshPhysicalMaterial({ color: 0xdfeff2, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.08, envMapIntensity: 0.08, depthWrite: false, side: THREE.DoubleSide });
const mBrick = STD({ map: tex('tex/brick_diffuse.jpg', { rep: [30, 3] }), bumpMap: tex('tex/brick_bump.jpg', { srgb: false, rep: [30, 3] }), bumpScale: 1, roughness: 0.9, color: 0xc99382 });
const mAsphalt = STD({ color: 0x3b3b3f, roughness: 0.95 });
const mGrass = STD({ map: tex('tex/grasslight-big.jpg', { rep: [6, 2] }), roughness: 1, color: 0x9fb48a });
const mSoil = STD({ color: 0x3a2b20, roughness: 1 });
const mRust = STD({ color: 0x5e4334, metalness: 0.5, roughness: 0.7 });
const mCeil = STD({ color: 0xcfc9bf, roughness: 0.95 });
const mDarkCeil = STD({ color: 0x2b2524, roughness: 0.9 });

function box(w, h, d, mat, x, y, z, parent = scene, cast = true, recv = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m;
}
function cyl(rt, rb, h, mat, x, y, z, parent = scene, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function plane(w, h, mat, x, y, z, ry = 0, parent = scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m;
}
const cardBuckets = {};
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646);
const pick = a => a[Math.floor(rnd() * a.length)];

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function textTex(lines, w, h, bg) {
  return canvasTex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const total = lines.reduce((s, l) => s + l.size * (l.lh || 1.1), 0); let y = h / 2 - total / 2;
    for (const l of lines) {
      const lh = l.size * (l.lh || 1.1);
      g.font = `${l.weight || 800} ${l.size}px ${l.mono ? '"IBM Plex Mono", monospace' : '"Bricolage Grotesque", sans-serif'}`;
      g.fillStyle = l.color; if (l.glow) { g.shadowColor = l.color; g.shadowBlur = l.glow; }
      g.fillText(l.text, w / 2, y + lh / 2); g.shadowBlur = 0; y += lh;
    }
  });
}

const _lateMats = []; function coverMats_late(i) { const m = STD({ roughness: 0.55 }); _lateMats.push([m, i]); return m; }
// ---------------- architecture ----------------
// interior: x 0..11, z 0..10 ; portico z 10..14.5 ; corridor x 11..14.6
const PORT_Y = 3.4;
walkables.push(box(11, 0.1, 10, mWood, 5.5, -0.05, 5, scene, false));
walkables.push(box(25, 0.1, 4.5, mTrav, 3.5, -0.05, 12.25, scene, false));
walkables.push(box(3.6, 0.1, 16.5, mTravC, 12.8, -0.05, 6.25, scene, false));
// dark stripes in travertine (as in the real portico)
for (const x of [-4.5, 0.9, 6.3]) box(0.45, 0.012, 4.5, STD({ color: 0x2a2a2c, roughness: 0.4 }), x, 0.006, 12.25, scene, false);
// portico ceilings and slab edge
box(25, 0.35, 4.6, mCeil, 3.5, PORT_Y + 0.17, 12.25, scene, false);
box(3.8, 0.35, 16.5, mCeil, 12.8, PORT_Y + 0.17, 6.25, scene, false);
box(25.6, 0.9, 0.35, mConcrete, 3.5, PORT_Y + 0.45, 14.65);
// interior ceiling (dark, industrial) + upper floors
box(11, 0.2, 10, mDarkCeil, 5.5, 3.2, 5, scene, false);
// ---------------- Bestat towers ----------------
// fin tower (Piccinato): white vertical fins, recessed windows with pale green spandrels
const finTex = canvasTex(256, 1024, (g, w, h) => {
  g.fillStyle = '#3a4046'; g.fillRect(0, 0, w, h);
  for (let f = 0; f < 16; f++) { const y = f * 64; g.fillStyle = '#b9c4b0'; g.fillRect(0, y, w, 16); g.fillStyle = '#2b3036'; g.fillRect(0, y + 16, w, 44); g.fillStyle = '#5a646c'; g.fillRect(w * 0.48, y + 16, 6, 44); if ((f * 13 + 3) % 7 === 0) { g.fillStyle = '#e9b46e'; g.fillRect(20, y + 20, w * 0.4, 36); } g.fillStyle = '#d8d4ca'; g.fillRect(0, y + 60, w, 4); }
  g.fillStyle = '#e8e4da'; g.fillRect(0, 0, 40, h); g.fillRect(w - 40, 0, 40, h);
});
finTex.wrapS = finTex.wrapT = THREE.RepeatWrapping;
// ochre balcony tower
const ochreTex = canvasTex(512, 1024, (g, w, h) => {
  g.fillStyle = '#b8a47c'; g.fillRect(0, 0, w, h);
  for (let f = 0; f < 16; f++) { const y = f * 64; g.fillStyle = '#d9cfb6'; g.fillRect(0, y + 44, w, 14); g.fillStyle = '#4a4740'; for (let x = 12; x < w; x += 64) { g.fillRect(x, y + 8, 40, 34); } g.fillStyle = '#8f7f60'; g.fillRect(0, y + 58, w, 6); if ((f * 5) % 3 === 0) { g.fillStyle = '#e7b56f'; g.fillRect(140, y + 10, 40, 30); } }
});
ochreTex.wrapS = ochreTex.wrapT = THREE.RepeatWrapping;
function tower(x0, x1, z0, z1, yb, yt, texSrc, rep = 1.25) {
  const w = x1 - x0, d = z1 - z0, h = yt - yb;
  const mk = (len) => { const t = texSrc.clone(); t.needsUpdate = true; t.repeat.set(len / (rep * 4), h / 48); return STD({ map: t, roughness: 0.85 }); };
  const mx = mk(d), mz = mk(w), mtop = STD({ color: 0x9a948a }); mx.color.setHex(0xc9c4ba); mz.color.setHex(0xc9c4ba);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, mtop, mtop, mz, mz]);
  m.position.set((x0 + x1) / 2, yb + h / 2, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}
const mFin = STD({ color: 0xc8c3b8, roughness: 0.85 });
function fins(axis, fixed, from, to, yb, yt, step = 1.25, depth = 0.7, crown = true) { // real 3D fins on a façade
  const n = Math.floor((to - from) / step) + 1; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mFin, n); const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { const p = from + i * step; const top = yt + (crown ? ((i * 7) % 5 === 0 ? 4.5 : (i * 3) % 4 === 0 ? 2.5 : 0.6) : 0); const h = top - yb;
    if (axis === 'z') o.position.set(p, yb + h / 2, fixed + depth / 2); else o.position.set(fixed + depth / 2 * (axis === 'x' ? 1 : -1), yb + h / 2, p);
    o.scale.set(axis === 'z' ? 0.32 : depth, h, axis === 'z' ? depth : 0.32); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
  im.castShadow = true; im.receiveShadow = true; scene.add(im);
}
// our tower above the portico (fins facing the piazza)
tower(-9, 16, -6, 14.8, PORT_Y + 0.9, 62, finTex);
fins('z', 14.8, -9, 16, PORT_Y + 0.9, 62);
cyl(0.25, 0.4, 16, mBlackMetal, 2, 70, 4);
// Tower B continues west of the shop and turns north along the piazza (stepped blocks, double pillars)
tower(-34, -9, -6, 10, PORT_Y + 0.9, 58, finTex); fins('z', 10, -34, -9, PORT_Y + 0.9, 58); fins('z', 10, -33.55, -9, PORT_Y + 0.9, 58, 1.25, 0.7, false);
for (const [z0, z1, h] of [[10, 34, 58], [34, 56, 50], [56, 80, 42]]) { tower(-36, -17, z0, z1, 4.2, h, finTex); fins('x', -17, z0, z1, 4.2, h); fins('x', -17, z0 + 0.45, z1, 4.2, h, 1.25, 0.7, false); }

// back + left interior walls
box(11, 3.2, 0.2, mPlaster, 5.5, 1.6, -0.1);
box(0.2, 3.2, 10, mPlaster, -0.1, 1.6, 5);
// back rooms (storage + WC)
box(5.2, 3.0, 0.12, mPlasterWarm, 2.6, 1.5, 2.5);
box(0.12, 3.0, 2.5, mPlasterWarm, 5.2, 1.5, 1.25);
box(0.9, 2.1, 0.04, mOak, 1.4, 1.05, 2.57); box(0.9, 2.1, 0.04, mOak, 4.2, 1.05, 2.57);

// front façade z=10: glazing x0..5.6 (+6.8..7.2), door 5.6..6.8, blind 7.2..11
function glazingX(x0, x1, z) { const len = x1 - x0, mid = (x0 + x1) / 2; box(len, 0.16, 0.12, mSteel, mid, 3.05, z); box(len, 0.1, 0.12, mSteel, mid, 0.05, z); const g = plane(len, 2.95, mGlass, mid, 1.55, z); g.renderOrder = 2; }
function glazingZ(z0, z1, x) { const len = z1 - z0, mid = (z0 + z1) / 2; box(0.12, 0.16, len, mSteel, x, 3.05, mid); box(0.12, 0.1, len, mSteel, x, 0.05, mid); const g = plane(len, 2.95, mGlass, x, 1.55, mid, Math.PI / 2); g.renderOrder = 2; }
glazingX(0, 5.6, 10); glazingX(6.8, 7.2, 10);
for (const x of [0, 1.4, 2.8, 4.2, 5.6, 6.8, 7.2]) box(0.1, 3.1, 0.14, mSteel, x, 1.55, 10);
const door = new THREE.Group(); door.position.set(5.6, 0, 10); door.rotation.y = -1.05; scene.add(door);
{ const g = box(1.15, 2.65, 0.03, mGlass, 0.58, 1.33, 0, door, false); g.renderOrder = 2; box(1.15, 0.06, 0.05, mBlackMetal, 0.58, 2.66, 0, door); box(0.05, 2.65, 0.05, mBlackMetal, 1.15, 1.33, 0, door); box(0.03, 0.9, 0.04, mSteel, 1.05, 1.1, 0.05, door); }
// blind corner, painted bordeaux outside
box(3.8, 3.3, 0.22, mBord, 9.1, 1.65, 10.05);
box(0.22, 3.3, 4.2, mBord, 11.05, 1.65, 7.9);
glazingZ(0, 4.8, 11);
for (const z of [0, 1.2, 2.4, 3.6, 4.8, 5.8]) box(0.14, 3.1, 0.1, mSteel, 11, 1.55, z);
{ const g = box(0.03, 2.65, 1.0, mGlass, 11, 1.33, 5.3, scene, false); g.renderOrder = 2; }
// fascia with luminous text
const fasciaTex = textTex([{ text: 'BIRRE ARTIGIANALI  ·  VINILI  ·  LIBRI & FANZINE', size: 64, color: '#FFB451', mono: true, weight: 500, glow: 14 }], 2400, 110, '#121212');
box(7.2, 0.36, 0.08, STD({ color: 0x121212 }), 3.6, 3.32, 10.1, scene, false);
plane(7.1, 0.33, STD({ map: fasciaTex, emissive: 0xffffff, emissiveMap: fasciaTex, emissiveIntensity: 1.6 }), 3.6, 3.32, 10.15);
// main signage (letters slightly emissive / backlit)
const signTex = textTex([
  { text: 'SOTTO', size: 190, color: '#F2EADA', lh: 0.95 }, { text: 'PORTICO', size: 190, color: '#F2EADA', lh: 0.95 },
  { text: '—', size: 60, color: '#EEA640', lh: 0.9 }, { text: 'BIRRE · DISCHI · CARTA', size: 58, color: '#EEA640', mono: true, weight: 500, lh: 1.2 }], 1100, 760, null);
plane(3.3, 2.28, STD({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.35, roughness: 0.6 }), 9.1, 1.85, 10.17);
const sign2 = textTex([{ text: 'LISTENING', size: 150, color: '#F2EADA', lh: 1 }, { text: 'BAR', size: 150, color: '#F2EADA', lh: 1 }, { text: 'MAR—DOM · 17:00—01:00', size: 52, color: '#EEA640', mono: true, weight: 500, lh: 1.6 }], 1100, 640, null);
plane(3.3, 1.92, STD({ map: sign2, transparent: true, emissive: 0xffffff, emissiveMap: sign2, emissiveIntensity: 0.35 }), 11.17, 1.8, 7.9, Math.PI / 2);

// ---- shop-front details ----
// window decals on the glass
const decal = textTex([{ text: 'VINILI NUOVI E USATI', size: 34, color: '#F2EADA', mono: true, weight: 500, lh: 1.5 }, { text: 'BIRRE ARTIGIANALI · SPINA E LATTINE', size: 34, color: '#F2EADA', mono: true, weight: 500, lh: 1.5 }, { text: 'EDITORIA INDIPENDENTE', size: 34, color: '#F2EADA', mono: true, weight: 500, lh: 1.5 }], 900, 200, null);
plane(1.25, 0.28, STD({ map: decal, transparent: true, roughness: 0.4 }), 0.7, 1.55, 10.03);
plane(1.25, 0.28, STD({ map: decal, transparent: true, roughness: 0.4 }), 4.9, 1.55, 10.03);
const logoTex = canvasTex(512, 512, (g, w, h) => { g.strokeStyle = '#EEA640'; g.lineWidth = 18; g.beginPath(); g.arc(w / 2, h / 2, 230, 0, 7); g.stroke(); g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, 120, 0, 7); g.stroke(); g.fillStyle = '#EEA640'; g.beginPath(); g.arc(w / 2, h / 2, 26, 0, 7); g.fill(); g.font = '800 64px "Bricolage Grotesque"'; g.textAlign = 'center'; g.fillStyle = '#F2EADA'; g.fillText('SOTTO', w / 2, h / 2 - 150); g.fillText('PORTICO', w / 2, h / 2 + 196); });
plane(0.9, 0.9, STD({ map: logoTex, transparent: true }), 2.1, 1.6, 10.03);
// neon in the window
const neonTex = textTex([{ text: 'listening bar', size: 120, color: '#ff8a5c', weight: 600, glow: 30 }], 1024, 220, null);
plane(1.6, 0.34, STD({ map: neonTex, transparent: true, emissive: 0xffffff, emissiveMap: neonTex, emissiveIntensity: 3.2, depthWrite: false }), 3.5, 2.45, 9.8);
// record display on easels behind the glass
for (let i = 0; i < 5; i++) { const x = 0.5 + i * 1.05; box(0.03, 0.9, 0.03, mOak, x, 0.45, 9.55); const r = plane(0.31, 0.31, coverMats_late(i), x, 1.05, 9.62); r.rotation.x = -0.12; }
// blade sign hanging from the portico ceiling
{ const g = new THREE.Group(); g.position.set(6.3, 2.75, 10.9); scene.add(g); box(0.02, 0.35, 0.02, mBlackMetal, 0, 0.42, 0, g); const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 48), STD({ color: 0x161616, roughness: 0.4 })); disc.rotation.z = Math.PI / 2; g.add(disc); const f1 = plane(0.82, 0.82, STD({ map: logoTex, transparent: true, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.4 }), 0.03, 0, 0, Math.PI / 2, g); const f2 = plane(0.82, 0.82, STD({ map: logoTex, transparent: true, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.4 }), -0.03, 0, 0, -Math.PI / 2, g); }
// A-frame chalkboard by the door
{ const g = new THREE.Group(); g.position.set(7.1, 0, 11.0); g.rotation.y = -0.4; scene.add(g);
  const chalk = textTex([{ text: 'OGGI', size: 70, color: '#EEA640', lh: 1.3 }, { text: 'album night', size: 52, color: '#F2EADA', weight: 500, lh: 1.25 }, { text: 'lato A → lato B', size: 40, color: '#F2EADA', mono: true, weight: 400, lh: 1.3 }, { text: 'ore 21', size: 52, color: '#F2EADA', weight: 600, lh: 1.3 }, { text: 'spina ospite', size: 40, color: '#EEA640', mono: true, weight: 400, lh: 1.3 }], 400, 640, '#1d211f');
  for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.z = s * 0.12; p.rotation.x = s * 0.16; g.add(p); box(0.62, 0.98, 0.03, mOak, 0, 0.5, 0, p); plane(0.54, 0.86, STD({ map: chalk, roughness: 0.95 }), 0, 0.52, s * 0.017, s > 0 ? 0 : Math.PI, p); } }
// bike parked at a column
{ const g = new THREE.Group(); g.position.set(-8.5, 0, 13.4); g.rotation.y = 0.15; scene.add(g); const mt = STD({ color: 0x2f4f4f, metalness: 0.6, roughness: 0.4 });
  for (const z of [-0.5, 0.5]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 32), STD({ color: 0x151515, roughness: 0.8 })); w.position.set(0, 0.35, z); w.rotation.y = Math.PI / 2; g.add(w); }
  const bar = (a, b) => { const v = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, v.length(), 8), mt); m.position.copy(new THREE.Vector3(...a).add(v.clone().multiplyScalar(0.5))); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); m.castShadow = true; g.add(m); };
  bar([0, 0.35, -0.5], [0, 0.85, -0.05]); bar([0, 0.35, -0.5], [0, 0.4, 0.05]); bar([0, 0.4, 0.05], [0, 0.85, -0.05]); bar([0, 0.85, -0.05], [0, 0.85, 0.4]); bar([0, 0.4, 0.05], [0, 0.85, 0.4]); bar([0, 0.35, 0.5], [0, 1.0, 0.42]); box(0.1, 0.04, 0.24, STD({ color: 0x3a2a20 }), 0, 0.95, -0.08, g); box(0.5, 0.03, 0.03, mt, 0, 1.02, 0.42, g); }

// portico columns (front opens onto the pedestrian piazza)
for (let x = -8; x <= 14; x += 4.4) box(0.6, PORT_Y, 0.6, mColumn, x, PORT_Y / 2, 14.2);
for (const z of [-1, 3.5, 8]) box(0.6, PORT_Y, 0.6, mColumn, 14.3, PORT_Y / 2, z);
box(0.25, PORT_Y, 16.5, mPlaster, 14.85, PORT_Y / 2, 6.25);
function railing(x0, x1, z) {
  const len = x1 - x0, mid = (x0 + x1) / 2;
  box(len, 0.07, 0.09, mRust, mid, 1.05, z); box(len, 0.05, 0.05, mRust, mid, 0.1, z);
  const n = Math.floor(len / 0.11); const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.95, 0.012), mBlackMetal, n);
  const o = new THREE.Object3D(); for (let i = 0; i < n; i++) { o.position.set(x0 + i * 0.11, 0.57, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } scene.add(im);
}
// one step down from the portico to the piazza
walkables.push(box(25.6, 0.12, 0.5, mTrav, 3.5, -0.06, 14.75, scene, false));

// ---------------- Piazzale Dante / Bestat (pedestrian, travertine with zig-zag bands) ----------------
const chevTex = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#dcd9d2'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${(Math.random() * 0.045).toFixed(3)})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 7, 2 + Math.random() * 7); }
  const P = 128, A = 64; g.strokeStyle = '#70757a'; g.lineWidth = 30; g.lineJoin = 'miter';
  for (let y0 = -256; y0 < h + 256; y0 += 256) { g.beginPath(); for (let k = -2; k <= w / (P / 2) + 2; k++) { const x = k * P / 2, yy = y0 + (((k % 2) + 2) % 2 === 0 ? 0 : A); k === -2 ? g.moveTo(x, yy) : g.lineTo(x, yy); } g.stroke(); }
  g.strokeStyle = 'rgba(90,90,90,0.22)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
});
chevTex.wrapS = chevTex.wrapT = THREE.RepeatWrapping; chevTex.repeat.set(48 / 8, 74 / 8);
const mPiazza = STD({ map: chevTex, color: 0xb3afa7, roughness: 0.62, envMapIntensity: 0.12 });
walkables.push(box(48, 0.1, 74, mPiazza, 7, -0.07, 51.9, scene, false));
box(320, 0.1, 320, STD({ color: 0x77736c, roughness: 0.95 }), 7, -0.12, 60, scene, false);
const grateTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#2a2d30'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8b9095'; g.lineWidth = 3; for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } });
grateTex.wrapS = grateTex.wrapT = THREE.RepeatWrapping; grateTex.repeat.set(4, 8);
const mGrate = STD({ map: grateTex, metalness: 0.5, roughness: 0.5 });
const mCurb = STD({ color: 0xbdb9b0, roughness: 0.75 });
// linear green strips with skylight grates over the via Dante underpass
function greenStrip(x, z0, z1) {
  const len = z1 - z0, zc = (z0 + z1) / 2;
  box(2.6, 0.22, len, mCurb, x, 0.11, zc); box(1.0, 0.04, len - 0.3, mGrass, x - 0.6, 0.23, zc, scene, false);
  for (let z = z0 + 1.2; z < z1 - 1.5; z += 3.2) { box(1.0, 0.03, 2.2, mGrate, x + 0.6, 0.235, z + 1.1, scene, false); box(1.05, 0.1, 0.12, mCurb, x + 0.6, 0.27, z, scene, false); }
  for (let z = z0 + 0.6; z < z1; z += 0.5) bush('shrub', x - 0.6, 0.25, z, 0.25, 1);
  obBox(x - 1.3, z0, x + 1.3, z1);
}
greenStrip(13, 24, 46); greenStrip(13, 52, 72); greenStrip(18.5, 30, 66);
const mBench = STD({ color: 0xcfcac1, roughness: 0.75 });
for (const [x, z] of [[10.6, 28], [10.6, 36], [10.6, 58], [10.6, 66], [21.3, 40], [21.3, 52]]) { box(0.55, 0.45, 2.2, mBench, x, 0.225, z); obBox(x - 0.32, z - 1.15, x + 0.32, z + 1.15); }
function lampPost(x, z) {
  cyl(0.07, 0.12, 8.5, mBlackMetal, x, 4.25, z, scene, 12); obCirc(x, z, 0.2);
  for (const s of [-1, 1]) { box(0.8, 0.05, 0.05, mBlackMetal, x + s * 0.4, 8.4, z); box(0.36, 0.14, 0.36, mBlackMetal, x + s * 0.78, 8.32, z); box(0.3, 0.03, 0.3, STD({ color: 0xffffff, emissive: 0xffdcaa, emissiveIntensity: 3 }), x + s * 0.78, 8.24, z, scene, false); }
  const l = new THREE.PointLight(0xffd2a0, 14, 18, 2); l.position.set(x, 7.9, z); scene.add(l);
}
for (const z of [26, 40, 54, 68]) lampPost(24.5, z);
lampPost(4, 30); lampPost(4, 62);

// ---------------- Biblioteca civica Pietro Acclavio ----------------
// white drum of vertical fins under a deep white fascia, raised on pilotis, planted terraces and stairs; set against Tower B
const LIB = new THREE.Vector3(-5, 0, 47), LR = 12;
{
  const gr = new THREE.Group(); gr.position.copy(LIB); scene.add(gr);
  const mWhite = STD({ color: 0xd2cec5, roughness: 0.7, envMapIntensity: 0.1 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(LR - 2.6, LR - 2.6, 3.2, 64), STD({ color: 0x2b2e31, roughness: 0.4, metalness: 0.3 })); base.position.y = 1.6; gr.add(base);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; cyl(0.38, 0.38, 3.2, STD({ color: 0xd9d5cc, roughness: 0.8 }), Math.cos(a) * (LR - 1.4), 1.6, Math.sin(a) * (LR - 1.4), gr, 20); }
  const soffit = new THREE.Mesh(new THREE.CylinderGeometry(LR + 0.2, LR - 2.6, 0.5, 64), mWhite); soffit.position.y = 3.35; gr.add(soffit);
  const winTex = canvasTex(2048, 256, (g, w, h) => { g.fillStyle = '#2f3940'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { const lit = Math.random() < 0.35; g.fillStyle = lit ? '#e9c389' : '#3d4a52'; g.fillRect(x + 3, 12, 26, h * 0.62); g.fillStyle = lit ? '#d9b07a' : '#34404a'; g.fillRect(x + 3, h * 0.72, 26, h * 0.24); } });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(LR - 0.25, LR - 0.25, 5.7, 96, 1, true), STD({ map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.3, envMapIntensity: 0.9 }));
  glass.position.y = 6.45; gr.add(glass);
  const sill = new THREE.Mesh(new THREE.CylinderGeometry(LR + 0.35, LR + 0.35, 0.3, 96), mWhite); sill.position.y = 3.7; sill.castShadow = true; gr.add(sill);
  const N = 120; const finIm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 5.6, 0.2), mWhite, N); const o = new THREE.Object3D();
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; o.position.set(Math.cos(a) * (LR + 0.1), 6.6, Math.sin(a) * (LR + 0.1)); o.rotation.set(0, -a, 0); o.updateMatrix(); finIm.setMatrixAt(i, o.matrix); }
  finIm.castShadow = true; finIm.receiveShadow = true; gr.add(finIm);
  const fascia = new THREE.Mesh(new THREE.CylinderGeometry(LR + 1.0, LR + 0.85, 1.9, 96), mWhite); fascia.position.y = 10.3; fascia.castShadow = true; fascia.receiveShadow = true; gr.add(fascia);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(LR + 0.9, LR + 0.9, 0.2, 96), STD({ color: 0x9c978e })); roof.position.y = 11.25; gr.add(roof);
  for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + 0.42 + i * (Math.PI * 1.25) / 16; const r = LR + 2.2; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (LIB.x + x < -16.5) continue;
    const pb = box(3.8, 0.9, 1.6, mCurb, x, 0.45, z, gr); pb.rotation.y = -a + Math.PI / 2;
    bush(i % 4 === 0 ? 'flowerbed' : 'shrub', LIB.x + x, 0.95, LIB.z + z, 0.9, 20); }
  for (let k = 0; k < 4; k++) box(4.2, 0.22, 0.45, mCurb, 0, 0.11 + k * 0.22, -(LR + 3.6) + k * 0.42, gr);
  const tt = textTex([{ text: 'BIBLIOTECA CIVICA', size: 46, color: '#161616', weight: 700, lh: 1.2 }, { text: 'PIETRO ACCLAVIO', size: 62, color: '#161616', weight: 800, lh: 1.2 }], 640, 220, '#f2efe8');
  box(2.2, 0.75, 0.18, STD({ color: 0xf2efe8 }), 3.4, 0.9, -(LR + 4.2), gr); plane(2.1, 0.72, STD({ map: tt }), 3.4, 0.9, -(LR + 4.31), Math.PI, gr);
  cyl(0.03, 0.03, 0.55, mBlackMetal, 2.6, 0.27, -(LR + 4.2), gr, 8); cyl(0.03, 0.03, 0.55, mBlackMetal, 4.2, 0.27, -(LR + 4.2), gr, 8);
  const ll = new THREE.PointLight(0xffd7a8, 5, 10, 2); ll.position.set(0, 2.6, -(LR + 0.5)); gr.add(ll);
  obCirc(LIB.x, LIB.z, LR + 3.1); obBox(LIB.x + 2.2, LIB.z - (LR + 4.4), LIB.x + 4.6, LIB.z - (LR + 4.0));
}

// ---------------- Tower A: 21 floors, continuous balconies with planters, blue infill panels, anodized fake pillars ----------------
const towerATex = canvasTex(512, 1024, (g, w, h) => {
  g.fillStyle = '#8f8270'; g.fillRect(0, 0, w, h);
  for (let f = 0; f < 16; f++) { const y = f * 64; g.fillStyle = '#3f5f7d'; for (let x = 0; x < w; x += 64) g.fillRect(x + 6, y + 10, 30, 40); g.fillStyle = '#2a2e33'; for (let x = 0; x < w; x += 64) g.fillRect(x + 38, y + 8, 20, 46); if ((f * 11) % 7 === 2) { g.fillStyle = '#e9b56f'; g.fillRect(230, y + 12, 18, 40); } }
  g.fillStyle = '#c9ccd0'; for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 8, h);
});
towerATex.wrapS = towerATex.wrapT = THREE.RepeatWrapping;
tower(31, 50, 12, 82, 4.4, 70, towerATex, 2);
{ const n = 21, o = new THREE.Object3D();
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.22, 70), STD({ color: 0xa69a86, roughness: 0.85 }), n);
  const para = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.95, 70), STD({ color: 0x9a8e7a, roughness: 0.85 }), n);
  for (let i = 0; i < n; i++) { const y = 4.6 + i * 3.1; o.position.set(30.25, y, 47); o.updateMatrix(); slabs.setMatrixAt(i, o.matrix); o.position.set(29.55, y + 0.55, 47); o.updateMatrix(); para.setMatrixAt(i, o.matrix); }
  slabs.castShadow = para.castShadow = true; slabs.receiveShadow = para.receiveShadow = true; scene.add(slabs, para);
  for (let i = 0; i < n; i += 2) for (let z = 14; z < 80; z += 2.4) if ((i * 7 + z) % 3 < 1.6) card('shrub', 29.6, 4.6 + i * 3.1 + 1.15, z + Math.random(), 0.7, 0, Math.PI / 2, Math.random() * 6);
  // glazed ground floor + arcade
  box(0.06, 3.6, 66, STD({ color: 0x2c3540, emissive: 0xffc98a, emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.4 }), 31.2, 1.8, 47, scene, false);
  for (let z = 14; z <= 80; z += 4.4) { box(0.55, 4.4, 0.55, mColumn, 29.3, 2.2, z); obBox(29.0, z - 0.3, 29.6, z + 0.3); }
  obBox(31, 12, 50, 82);
}
// Tower B footprints (west + south wings) for collisions
obBox(-36, 10, -17, 80); obBox(-34, -6, -9, 10);
// arcade with shops at the base of Tower B (west side)
for (let z = 12; z <= 78; z += 4.4) { box(0.55, 4.2, 0.55, mColumn, -16.3, 2.1, z); obBox(-16.6, z - 0.3, -16.0, z + 0.3); }
box(0.06, 3.4, 66, STD({ color: 0x2c3540, emissive: 0xffc98a, emissiveIntensity: 0.22, roughness: 0.15, metalness: 0.4 }), -18.4, 1.7, 45, scene, false);
box(2.2, 0.3, 68, mCeil, -17.3, 4.05, 45, scene, false);
// pedestrian bridge / canopy across the far end, with the stairs down to the underpass
{ const mDark = STD({ color: 0x343330, roughness: 0.7 });
  box(48, 1.0, 4.4, mDark, 7, 4.9, 84); box(48, 0.25, 4.6, mCurb, 7, 4.3, 84);
  for (let x = -14; x <= 28; x += 7) { box(0.6, 4.2, 0.6, mColumn, x, 2.1, 84); obCirc(x, 84, 0.45); }
  // sunken stair well
  box(12, 0.12, 5, STD({ color: 0x55524c, roughness: 0.9 }), 7, -1.2, 79.5, scene, false);
  for (let k = 0; k < 6; k++) box(12, 0.2, 0.42, mCurb, 7, -0.1 - k * 0.2, 77.2 + k * 0.42, scene, false);
  railing(1, 13, 76.9); obBox(1, 76.8, 13, 82.2);
}

// ---------------- vegetation (alpha cards) ----------------
const leafTex = {};
for (const k of ['jasmine', 'ivy', 'olive', 'flowerbed', 'shrub']) leafTex[k] = tex('tex/' + k + '.png');
const leafMat = {};
for (const k in leafTex) leafMat[k] = STD({ map: leafTex[k], alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.65, envMapIntensity: 0.35 });
const cardGeo = new THREE.PlaneGeometry(1, 1);
function card(kind, x, y, z, s, rx, ry, rz) { (cardBuckets[kind] ||= []).push([x, y, z, s, rx, ry, rz]); }
function flushCards() {
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (const k in cardBuckets) {
    const arr = cardBuckets[k]; const im = new THREE.InstancedMesh(cardGeo, leafMat[k], arr.length); im.castShadow = true; im.receiveShadow = true;
    arr.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.scale.setScalar(p[3]); o.rotation.set(p[4], p[5], p[6]); o.updateMatrix(); im.setMatrixAt(i, o.matrix); c.setHSL(0, 0, 0.78 + rnd() * 0.3); im.setColorAt(i, c); });
    scene.add(im);
  }
}
// climber on a wall: plane defined by center, normal axis and size
function climber(cx, cz, w, h, axis, density = 26, kind = 'jasmine') {
  const n = Math.round(w * h * density);
  for (let i = 0; i < n; i++) {
    const u = (rnd() - 0.5) * w, v = Math.pow(rnd(), 0.75) * h, off = 0.05 + rnd() * 0.12, s = 0.32 + rnd() * 0.3;
    const yaw = { x: 0, '-x': Math.PI, z: Math.PI / 2, '-z': -Math.PI / 2 }[axis];
    let x, z; if (axis === 'x') { x = cx + u; z = cz + off; } else if (axis === '-x') { x = cx + u; z = cz - off; } else if (axis === 'z') { x = cx + off; z = cz + u; } else { x = cx - off; z = cz + u; }
    card(rnd() < 0.8 ? kind : 'ivy', x, v + 0.15, z, s, (rnd() - 0.5) * 0.9, yaw + (rnd() - 0.5) * 0.9, rnd() * 6.28);
  }
  // thin trellis wires
  const len = axis === 'x' || axis === '-x';
  for (let k = -w / 2; k <= w / 2 + 0.01; k += 0.45) box(0.008, h, 0.008, mBlackMetal, len ? cx + k : cx + (axis === 'z' ? 0.03 : -0.03), h / 2, len ? cz + (axis === 'x' ? 0.03 : -0.03) : cz + k, scene, false);
}
function bush(kind, x, y, z, r, n) { for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r; card(kind, x + Math.cos(a) * d, y + rnd() * r * 0.7, z + Math.sin(a) * d, 0.35 + rnd() * 0.35, (rnd() - 0.5) * 1.6, rnd() * 6.28, rnd() * 6.28); } }
function olive(x, y, z, H = 2.4) {
  const trunkM = STD({ color: 0x5b4c3e, roughness: 0.95 });
  let px = x, pz = z; for (let i = 0; i < 4; i++) { const nx = px + (rnd() - 0.5) * 0.12, nz = pz + (rnd() - 0.5) * 0.12; const seg = cyl(0.07 - i * 0.012, 0.09 - i * 0.012, H * 0.17, trunkM, (px + nx) / 2, y + H * 0.17 * (i + 0.5), (pz + nz) / 2, scene, 10); seg.rotation.z = (rnd() - 0.5) * 0.25; px = nx; pz = nz; }
  for (let i = 0; i < 70; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * H * 0.33; card('olive', px + Math.cos(a) * d, y + H * 0.62 + rnd() * H * 0.4, pz + Math.sin(a) * d, 0.5 + rnd() * 0.4, (rnd() - 0.5) * 1.2, rnd() * 6.28, rnd() * 6.28); }
}
function planter(x, z, w, d, kind) {
  obBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
  box(w, 0.6, d, mConcrete, x, 0.3, z); box(w - 0.1, 0.03, d - 0.1, mSoil, x, 0.6, z, scene, false);
  if (kind === 'olive') { olive(x, 0.6, z); bush('shrub', x, 0.65, z, Math.min(w, d) * 0.35, 10); }
  else { const n = Math.round(w * d * 40); for (let i = 0; i < n; i++) card(rnd() < 0.6 ? 'flowerbed' : 'shrub', x + (rnd() - 0.5) * (w - 0.15), 0.72 + rnd() * 0.22, z + (rnd() - 0.5) * (d - 0.12), 0.32 + rnd() * 0.22, -Math.PI / 2 + (rnd() - 0.5) * 1.4, rnd() * 6.28, rnd() * 6.28); }
}
// Canary palms and an umbrella pine, as on the real piazza
const frondTex = canvasTex(128, 512, (g, w, h) => { g.strokeStyle = '#5b4a2e'; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 0); g.stroke(); for (let y = 10; y < h - 20; y += 7) { const L = (Math.sin((y / h) * Math.PI) * 0.9 + 0.1) * w * 0.5; g.strokeStyle = `rgb(${50 + Math.random() * 25},${92 + Math.random() * 30},${40 + Math.random() * 20})`; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 - L, y + 22); g.moveTo(w / 2, y); g.lineTo(w / 2 + L, y + 22); g.stroke(); } });
const mFrond = STD({ map: frondTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 });
const barkTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6d5a43'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 24) for (let x = (y / 24) % 2 * 16; x < w; x += 32) { g.fillStyle = `rgb(${110 + Math.random() * 30},${90 + Math.random() * 20},${64 + Math.random() * 20})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 16, y + 12); g.lineTo(x, y + 24); g.lineTo(x - 16, y + 12); g.fill(); } });
barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping; barkTex.repeat.set(2, 6);
function palm(x, z, H = 7) {
  const tr = cyl(0.42, 0.55, H, STD({ map: barkTex, roughness: 0.95 }), x, H / 2, z, scene, 16); obCirc(x, z, 0.75);
  const fg = new THREE.PlaneGeometry(0.9, 3.6, 1, 8); const pos = fg.attributes.position; for (let i = 0; i < pos.count; i++) { const v = pos.getY(i) + 1.8; pos.setZ(i, -0.12 * v * v); } fg.translate(0, 1.8, 0); fg.computeVertexNormals();
  for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(fg, mFrond); m.position.set(x, H, z); m.rotation.set(0, (i / 26) * Math.PI * 2 + Math.random() * 0.2, 0); m.rotateX(-0.35 - (i % 3) * 0.25 - Math.random() * 0.2); m.castShadow = true; scene.add(m); }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), STD({ color: 0x5a6b33, roughness: 0.9 })); crown.position.set(x, H + 0.1, z); scene.add(crown);
}
palm(9.5, 33); palm(9.5, 61, 8); palm(-12.5, 26, 6.5);
function umbrellaPine(x, z, H = 9) {
  const tm = STD({ color: 0x6a4e3a, roughness: 0.95 }); const t = cyl(0.3, 0.45, H, tm, x, H / 2, z, scene, 12); t.rotation.z = 0.08; obCirc(x, z, 0.6);
  for (let i = 0; i < 260; i++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 4.6; card('shrub', x + Math.cos(a) * d + 0.5, H + 0.2 + Math.random() * 1.1 - d * 0.12, z + Math.sin(a) * d, 0.9 + Math.random() * 0.5, -Math.PI / 2 + (Math.random() - 0.5) * 0.6, Math.random() * 6.28, Math.random() * 6.28); }
}
umbrellaPine(16, 76, 9);

// portico planters between the columns (front stays open onto the piazza) and along the corridor
planter(-6.2, 13.75, 1.8, 0.6, 'flowers'); planter(-1.6, 13.75, 1.6, 0.6, 'olive'); planter(11.8, 13.75, 2.2, 0.6, 'flowers');
planter(14.2, 10.8, 0.6, 1.6, 'flowers'); planter(14.2, 5.8, 0.6, 1.8, 'olive'); planter(14.2, 1.4, 0.6, 1.8, 'flowers');
// large terracotta pots with olive trees on the piazza edge
const mTerra = STD({ color: 0xa65a3a, roughness: 0.85 });
function pot(x, z, r = 0.45) { obCirc(x, z, r); const p = cyl(r, r * 0.75, r * 1.6, mTerra, x, r * 0.8, z, scene, 28); box(r * 1.5, 0.02, r * 1.5, mSoil, x, r * 1.6, z, scene, false); olive(x, r * 1.6, z, 2.2); }
pot(-3.8, 15.6); pot(2.2, 15.7); pot(13.6, 15.6, 0.5);
// climbers on columns and corridor wall
for (let x = -8; x <= 14; x += 4.4) { climber(x, 13.88, 0.62, 3.3, '-x', 34); }
for (const z of [-1, 3.5, 8]) climber(13.98, z, 0.62, 3.3, '-z', 34);
climber(14.7, 6.25, 14, 3.3, '-z', 18, 'jasmine');
box(0.25, PORT_Y, 4.6, mPlaster, -9.2, PORT_Y / 2, 12.25); climber(-9.05, 12.25, 4.2, 3.3, 'z', 20);
climber(7.45, 10.18, 0.35, 3.2, 'x', 40); climber(11.18, 9.75, 0.35, 3.2, 'z', 40);

// festoon string lights from the shop front to the columns
{
  const bulbs = []; const cableM = new THREE.LineBasicMaterial({ color: 0x111111 });
  const spans = [[[0.2, 3.1, 10.2], [-3.6, 3.0, 14.0]], [[2.8, 3.1, 10.2], [0.8, 3.0, 14.0]], [[5.4, 3.1, 10.2], [5.2, 3.0, 14.0]], [[0.2, 3.1, 10.2], [5.4, 3.1, 10.2]], [[-3.6, 3.0, 14.0], [9.6, 3.0, 14.0]]];
  for (const [a, b] of spans) { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; const p = new THREE.Vector3().lerpVectors(new THREE.Vector3(...a), new THREE.Vector3(...b), t); p.y -= Math.sin(Math.PI * t) * 0.45; pts.push(p); if (i % 2 === 1) bulbs.push(p.clone().add(new THREE.Vector3(0, -0.06, 0))); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableM)); }
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 8), STD({ color: 0xffffff, emissive: 0xffc77a, emissiveIntensity: 5 }), bulbs.length); const o = new THREE.Object3D();
  bulbs.forEach((p, i) => { o.position.copy(p); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); scene.add(im);
  pl(1.5, 2.6, 12.0, 4, 6, 0xffc27a); pl(5.5, 2.6, 12.3, 4, 6, 0xffc27a);
}
// ---------------- lights ----------------
const hemi = new THREE.HemisphereLight(0x9fb2e0, 0x5a4636, 0.18); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffa060, 1.6); sun.position.copy(SUN_DIR).multiplyScalar(90).add(new THREE.Vector3(6, 0, 40)); sun.target.position.set(6, 0, 40); scene.add(sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 5, far: 220 }); sun.shadow.mapSize.set(isMobile ? 2048 : 4096, isMobile ? 2048 : 4096); scene.add(sun);
function pl(x, y, z, I, d = 10, col = 0xffc07a) { const l = new THREE.PointLight(col, I, d, 2); l.position.set(x, y, z); scene.add(l); return l; }
// interior warm lighting
pl(2.4, 2.7, 8.3, 14); pl(9.2, 2.7, 7.6, 16); pl(2.5, 2.5, 4.2, 9, 8); pl(8.2, 2.7, 2.4, 13); pl(9.6, 2.6, 5.4, 8, 6, 0xfff1dd);
// portico ceiling lights
for (const [x, z] of [[-6, 12.25], [-1.5, 12.25], [3.2, 12.25], [7.8, 12.25], [12.8, 10.5], [12.8, 4.5], [12.8, -0.5]]) {
  const glb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), STD({ color: 0xffffff, emissive: 0xfff1d8, emissiveIntensity: 2.2 })); glb.position.set(x, PORT_Y - 0.22, z); scene.add(glb);
  pl(x, PORT_Y - 0.5, z, 4.5, 8, 0xffe2b8);
}
// sign uplight
const sp = new THREE.SpotLight(0xffd7a0, 40, 7, 0.7, 0.6, 2); sp.position.set(9.1, 3.2, 11.2); sp.target.position.set(9.1, 1.6, 10.1); scene.add(sp, sp.target);
// pendant lamps (black enamel domes)
function pendant(x, z, y = 2.3) { cyl(0.006, 0.006, 3.1 - y, mBlackMetal, x, (3.1 + y) / 2, z); const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), STD({ emissive: 0xffdca6, emissiveIntensity: 6, color: 0xffffff })); s.position.set(x, y - 0.04, z); scene.add(s); const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.22, 0.2, 28, 1, true), STD({ color: 0x151515, metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide })); dome.position.set(x, y + 0.04, z); scene.add(dome); }
[[1.4, 8.3], [3.4, 8.3], [8.6, 7.4], [9.5, 7.4], [10.4, 7.4], [1.8, 4.3], [3.6, 4.3], [7.4, 2.4], [9.2, 2.4]].forEach(p => pendant(p[0], p[1]));

// ---------------- props ----------------
const coverTex = []; // abstract record covers
for (let i = 0; i < 16; i++) coverTex.push(canvasTex(256, 256, (g, w, h) => {
  const pal = [['#EEA640', '#161616', '#F2EADA'], ['#d9534f', '#F2EADA', '#1f2a44'], ['#2f8f83', '#f4e3c1', '#161616'], ['#6c4f8a', '#f2c14e', '#F2EADA'], ['#1f2a44', '#e6e1d3', '#d9534f'], ['#e9d8a6', '#005f73', '#ae2012'], ['#161616', '#EEA640', '#F2EADA'], ['#94d2bd', '#0a9396', '#001219']][i % 8];
  g.fillStyle = pal[0]; g.fillRect(0, 0, w, h); g.fillStyle = pal[1];
  const k = i % 4; if (k === 0) { g.beginPath(); g.arc(w * .5, h * .55, w * .3, 0, 7); g.fill(); } else if (k === 1) { for (let y = 0; y < h; y += 26) g.fillRect(0, y, w, 12); } else if (k === 2) { g.fillRect(w * .1, h * .1, w * .5, h * .8); } else { g.beginPath(); g.moveTo(0, h); g.lineTo(w, 0); g.lineTo(w, h); g.fill(); }
  g.fillStyle = pal[2]; g.font = '700 26px "Bricolage Grotesque", sans-serif'; g.fillText(['ONDE', 'MAR PICCOLO', 'IONIO', 'LATO B', 'SUD', 'NOTTURNO', 'TARAS', 'SALINELLA'][i % 8], 14, 36);
}));
const coverMats = coverTex.map(t => STD({ map: t, roughness: 0.55 }));
// standalone build: real album art from Spotify's CDN on the shop's sleeves (keeps the drawn cover if it can't load)
if (window.SP_ALBUMS && window.SP_ALBUMS.length) coverTex.forEach((t, i) => {
  const al = window.SP_ALBUMS[i % window.SP_ALBUMS.length], im = new Image(); im.crossOrigin = 'anonymous';
  const orig = document.createElement('canvas'); orig.width = t.image.width; orig.height = t.image.height; orig.getContext('2d').drawImage(t.image, 0, 0); t.userData.orig = orig;
  im.onload = () => { try { const g = t.image.getContext('2d'); g.drawImage(im, 0, 0, t.image.width, t.image.height); t.needsUpdate = true; } catch (e) { } };
  im.src = 'https://i.scdn.co/image/ab67616d00001e02' + al.img;
});
for (const [m, i] of _lateMats) { m.map = coverTex[(i * 3 + 1) % 16]; m.needsUpdate = true; }
const canLabels = ['#EEA640', '#2f8f83', '#d9534f', '#3355aa', '#F2EADA', '#161616', '#94a35a', '#c96a3c'].map((c, i) => canvasTex(128, 128, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = i === 4 ? '#4A1C26' : '#F2EADA'; g.fillRect(0, h * 0.42, w, h * 0.18); g.fillStyle = c; g.font = '700 14px "IBM Plex Mono"'; g.fillText(['IPA', 'PILS', 'SOUR', 'APA', 'BLANCHE', 'STOUT', 'SAISON', 'RED'][i], 18, h * 0.55); }));
const canMats = canLabels.map(t => STD({ map: t, metalness: 0.75, roughness: 0.28, envMapIntensity: 1.2 }));
const canGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.122, 20);
const mCupPlastic = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.28, envMapIntensity: 1.2, depthWrite: false });
const mBeer = new THREE.MeshPhysicalMaterial({ color: 0xd88a1e, roughness: 0.1, transparent: true, opacity: 0.88, emissive: 0x4a2400, emissiveIntensity: 0.4 });
const mFoam = STD({ color: 0xfff6e2, roughness: 0.9 });
const mKraft = STD({ color: 0xc19a6b, roughness: 0.95 });
function makeCan() { const g = new THREE.Group(); const c = new THREE.Mesh(canGeo, pick(canMats)); c.castShadow = true; g.add(c); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.033, 0.008, 20), mSteel); top.position.y = 0.064; g.add(top); return g; }
function makeCup() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.031, 0.105, 20), mBeer); b.position.y = -0.005; g.add(b); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.041, 0.018, 20), mFoam); f.position.y = 0.055; g.add(f); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.033, 0.135, 20, 1, true), mCupPlastic); c.renderOrder = 3; g.add(c); return g; }
function makeBag() { // origin at handle top, bag hangs in -Y
  const g = new THREE.Group(); const b = box(0.34, 0.36, 0.09, mKraft, 0, -0.26, 0, g); const rec = box(0.31, 0.31, 0.006, pick(coverMats), 0.0, -0.06, 0.0, g, false);
  const disc = cyl(0.148, 0.148, 0.004, STD({ color: 0x0b0b0b, roughness: 0.3 }), 0.07, -0.03, 0.01, g, 32); disc.rotation.x = Math.PI / 2;
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 18, Math.PI), mKraft); h.position.y = -0.08; g.add(h); return g; }
function makeRecord() { const g = new THREE.Group(); box(0.31, 0.31, 0.006, pick(coverMats), 0, 0, 0, g); return g; }
function makeBook() { const g = new THREE.Group(); box(0.15, 0.22, 0.025, pick(coverMats), 0, 0, 0, g); return g; }
function makeHeadphones_late() { const h = makeHeadphones(); h.scale.setScalar(1); scene.add(h); return h; }
function makeHeadphones() { const g = new THREE.Group(); const band = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 8, 24, Math.PI), mBlackMetal); g.add(band); for (const s of [-1, 1]) { const e = cyl(0.045, 0.045, 0.035, STD({ color: 0x1a1a1a, roughness: 0.5 }), s * 0.105, -0.01, 0, g, 18); e.rotation.z = Math.PI / 2; } return g; }

// ---------------- furniture (procedural, PBR) ----------------
const mMarble = STD({ color: 0xf1ede6, roughness: 0.25, envMapIntensity: 0.8 });
function bistroTable(x, z) { cyl(0.36, 0.36, 0.03, mMarble, x, 0.745, z, scene, 40); cyl(0.022, 0.022, 0.72, mBlackMetal, x, 0.37, z, scene, 12); cyl(0.22, 0.24, 0.025, mBlackMetal, x, 0.013, z, scene, 28); }
const mRattan = STD({ color: 0xb08a5a, roughness: 0.85 });
function bistroChair(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  box(0.42, 0.035, 0.42, mRattan, 0, 0.455, 0, g);
  const back = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.014, 8, 24, Math.PI), mBlackMetal); back.position.set(0, 0.62, -0.2); g.add(back);
  box(0.4, 0.12, 0.02, mRattan, 0, 0.72, -0.2, g);
  for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) { const l = cyl(0.012, 0.012, 0.46, mBlackMetal, a, 0.23, b, g, 8); }
  return g;
}

// interior: bar counter + cassa (counter along z=7.6, x 7.9..10.9)
box(3.0, 1.05, 0.6, mSteel, 9.4, 0.525, 7.6); box(3.12, 0.05, 0.72, mOak, 9.4, 1.075, 7.6);
box(0.6, 1.05, 1.4, mSteel, 7.95, 0.525, 8.0); box(0.72, 0.05, 1.52, mOak, 7.95, 1.075, 8.0);
box(0.34, 0.1, 0.28, mBlackMetal, 8.05, 1.15, 7.8); { const s = box(0.3, 0.2, 0.015, STD({ color: 0x111111, emissive: 0x7fbfff, emissiveIntensity: 0.6 }), 8.05, 1.33, 7.92); s.rotation.x = -0.35; }
box(0.07, 0.02, 0.14, mBlackMetal, 8.32, 1.11, 7.42);
const cassaTex = textTex([{ text: 'CASSA', size: 90, color: '#161616' }], 300, 110, '#EEA640');
plane(0.7, 0.25, STD({ map: cassaTex, emissive: 0xffffff, emissiveMap: cassaTex, emissiveIntensity: 0.3 }), 7.95, 2.45, 7.4); cyl(0.003, 0.003, 0.55, mBlackMetal, 7.95, 2.85, 7.4);
// tap wall on the inside of the blind corner (z≈9.85)
box(3.4, 3.1, 0.06, STD({ color: 0x2a1c1c, roughness: 0.6 }), 9.4, 1.55, 9.86);
box(3.0, 0.1, 0.1, mSteel, 9.4, 1.5, 9.78);
for (let i = 0; i < 8; i++) { const x = 8.2 + i * 0.34; cyl(0.014, 0.014, 0.12, mSteel, x, 1.42, 9.72, scene, 12); cyl(0.015, 0.02, 0.2, STD({ color: [0xEEA640, 0x4A1C26, 0xF2EADA, 0x2f8f83][i % 4], roughness: 0.4 }), x, 1.66, 9.7, scene, 12); }
box(1.6, 0.04, 0.4, mSteel, 9.4, 1.02, 9.6);
const boardTex = textTex([{ text: 'SPINE DI OGGI', size: 64, color: '#EEA640', lh: 1.4 }, { text: '1 · PILS LOCALE ......... 5', size: 38, color: '#F2EADA', mono: true, weight: 400, lh: 1.3 }, { text: '2 · IPA SALENTINA ...... 6', size: 38, color: '#F2EADA', mono: true, weight: 400, lh: 1.3 }, { text: '3 · STOUT AL CAFFÈ ...... 6', size: 38, color: '#F2EADA', mono: true, weight: 400, lh: 1.3 }, { text: '4 · SOUR ALLE CILIEGIE .. 7', size: 38, color: '#F2EADA', mono: true, weight: 400, lh: 1.3 }], 900, 320, '#1a1a1a');
plane(2.3, 0.82, STD({ map: boardTex, roughness: 0.9 }), 9.4, 2.35, 9.82, Math.PI);
// can shelves on side wall x=10.9
{ const n = 3 * 20; const ims = canMats.map(m => new THREE.InstancedMesh(canGeo, m, n)); const cnt = ims.map(() => 0); const o = new THREE.Object3D();
  for (const y of [1.0, 1.38, 1.76, 2.14]) { box(0.26, 0.025, 1.8, mOak, 10.86, y, 8.8); for (let z = 7.96; z < 9.68; z += 0.085) { const k = Math.floor(rnd() * ims.length); if (cnt[k] >= n) continue; o.position.set(10.86, y + 0.074, z); o.updateMatrix(); ims[k].setMatrixAt(cnt[k]++, o.matrix); } }
  ims.forEach((im, i) => { im.count = cnt[i]; scene.add(im); }); }

// vinyl bins + cover wall + listening stations
const binLabels = ['JAZZ', 'SOUL & FUNK', 'ELETTRONICA', 'ROCK', 'ITALIANA', 'AMBIENT'];
function vinylBin(x, z, ry, label) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  box(1.3, 0.72, 0.52, mOak, 0, 0.36, 0, g); box(1.22, 0.03, 0.44, STD({ color: 0x4a3626 }), 0, 0.73, 0, g);
  for (let i = 0; i < 24; i++) { const r = box(0.006, 0.315, 0.315, coverMats[(i * 5 + label.length) % 16], -0.58 + i * 0.048, 0.86, 0, g, false); r.rotation.z = -0.32 + Math.min(0.32, i * 0.03); }
  const lt = textTex([{ text: label, size: 44, color: '#F2EADA', mono: true, weight: 500 }], 420, 80, '#4A1C26');
  plane(0.6, 0.11, STD({ map: lt }), 0, 0.55, 0.262, 0, g);
}
vinylBin(1.2, 9.2, 0, binLabels[0]); vinylBin(2.8, 9.2, 0, binLabels[1]); vinylBin(4.4, 9.2, 0, binLabels[2]);
vinylBin(1.2, 7.3, Math.PI, binLabels[3]); vinylBin(2.8, 7.3, Math.PI, binLabels[4]); vinylBin(4.4, 7.3, Math.PI, binLabels[5]);
for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { const z = 6.75 + i * 0.44, y = 1.62 + j * 0.42; const p = box(0.012, 0.31, 0.31, coverMats[(i * 2 + j + 5) % 16], 0.045, y + 0.02, z, scene, false); p.rotation.z = -0.06; }
for (const y of [1.45, 1.87]) { box(0.08, 0.025, 2.75, mOak, 0.04, y, 7.85); box(0.01, 0.012, 2.7, new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), 0.085, y + 0.014, 7.85, scene, false); }
// wall finishes: bordeaux dado + oak rail + black skirting on the shop walls
{ const mDado = STD({ color: 0x3a1820, roughness: 0.8 }), mSkirt = STD({ color: 0x111111, roughness: 0.6 });
  box(0.02, 1.0, 3.6, mDado, 0.012, 0.5, 8.2, scene, false); box(0.04, 0.04, 3.6, mOak, 0.025, 1.0, 8.2);
  box(0.02, 0.1, 10, mSkirt, 0.012, 0.05, 5, scene, false); box(11, 0.1, 0.02, mSkirt, 5.5, 0.05, 0.012, scene, false); box(5.2, 0.1, 0.02, mSkirt, 2.6, 0.05, 2.62, scene, false); }
// cassa: register, card terminal, receipt printer
box(0.3, 0.09, 0.22, STD({ color: 0x222226, metalness: 0.3, roughness: 0.4 }), 8.05, 1.145, 8.25); box(0.09, 0.05, 0.16, STD({ color: 0x1a1a1a }), 7.85, 1.125, 8.45);
{ const pos = box(0.07, 0.015, 0.14, STD({ color: 0x111111, roughness: 0.3 }), 8.25, 1.11, 8.55); pos.rotation.y = 0.4; const sc = box(0.05, 0.002, 0.05, STD({ color: 0x0a0a0a, emissive: 0x3a7bd5, emissiveIntensity: 0.8 }), 8.25, 1.119, 8.52); sc.rotation.y = 0.4; }
const spinning = [];
for (let k = 0; k < 2; k++) { const z = 7.6 + k * 1.3; box(0.5, 1.0, 0.7, mOak, 0.26, 0.5, z); box(0.38, 0.07, 0.32, mBlackMetal, 0.26, 1.035, z); const p = cyl(0.135, 0.135, 0.008, STD({ color: 0x0b0b0b, roughness: 0.3 }), 0.26, 1.076, z, scene, 40); spinning.push(p); }

// lounge: felt panels, console, speakers, record shelves, rug
for (let i = 0; i < 4; i++) box(0.05, 1.1, 0.8, mFelt, 0.03, 1.75, 3.0 + i * 0.95);
// --- lounge back wall: walnut slat acoustic panel on black felt, with neon sign
const mWalnut = STD({ map: tex('tex/hardwood2_diffuse.jpg', { rep: [0.15, 1.2] }), color: 0x7a4e30, roughness: 0.55 });
box(5.1, 2.9, 0.025, STD({ color: 0x141214, roughness: 1 }), 2.6, 1.45, 2.575, scene, false);
{ const n = Math.floor(5.0 / 0.07); const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 2.9, 0.03), mWalnut, n), o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { o.position.set(0.12 + i * 0.07, 1.45, 2.605); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } im.receiveShadow = true; scene.add(im); }
{ const neon = textTex([{ text: 'lato B', size: 150, color: '#ffd3e0', glow: 28, weight: 700 }], 700, 230);
  const m = new THREE.MeshBasicMaterial({ map: neon, transparent: true, color: 0xffffff }); m.color.multiplyScalar(2.2);
  const p = plane(1.5, 0.5, m, 2.6, 2.35, 2.64); p.renderOrder = 2;
  const glow = new THREE.PointLight(0xff6f9a, 1.2, 3.2, 2); glow.position.set(2.6, 2.3, 2.9); scene.add(glow); }
box(2.0, 0.82, 0.55, mWalnut, 2.6, 0.41, 2.95); box(2.02, 0.03, 0.57, STD({ color: 0x161616, roughness: 0.35 }), 2.6, 0.835, 2.95); box(1.9, 0.06, 0.005, new THREE.MeshBasicMaterial({ color: 0xEEA640 }), 2.6, 0.08, 3.226, scene, false);
for (const x of [2.15, 3.05]) { box(0.45, 0.1, 0.36, mBlackMetal, x, 0.87, 2.95); const p = cyl(0.15, 0.15, 0.01, STD({ color: 0x0b0b0b, roughness: 0.25 }), x, 0.93, 2.95, scene, 40); const lbl = cyl(0.045, 0.045, 0.012, STD({ color: 0xEEA640 }), 0, 0.002, 0, p, 20); spinning.push(p); }
box(0.4, 0.12, 0.26, STD({ color: 0x2a2a2a, metalness: 0.5, roughness: 0.4 }), 2.6, 0.88, 2.95);
for (let i = 0; i < 4; i++) { const v = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), STD({ color: 0xffa040, emissive: 0xff9030, emissiveIntensity: 4 })); v.position.set(2.48 + i * 0.08, 0.98, 3.05); scene.add(v); }
const speakerCones = [];
function monitor(x, y, z, ry, sc = 1, parent = scene) { // two-way studio monitor, front faces +z (before rotation)
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(sc); parent.add(g);
  const mCab = STD({ map: tex('tex/hardwood2_diffuse.jpg', { rep: [0.4, 0.6] }), color: 0x6b4428, roughness: 0.45, envMapIntensity: 0.3 });
  const mBaffle = STD({ color: 0x151517, roughness: 0.7 }), mCone = STD({ color: 0x2a2a2c, roughness: 0.55 }), mSurr = STD({ color: 0x0c0c0c, roughness: 0.9 });
  box(0.36, 0.56, 0.36, mCab, 0, 0.28, 0, g); box(0.34, 0.54, 0.012, mBaffle, 0, 0.28, 0.181, g);
  const wf = new THREE.Group(); wf.position.set(0, 0.2, 0.19); g.add(wf);
  const sur = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 10, 36), mSurr); wf.add(sur);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.008, 8, 36), STD({ color: 0x9a9da2, metalness: 0.9, roughness: 0.3, envMapIntensity: 1 })); wf.add(ring);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.05, 36, 1, true), mCone); cone.rotation.x = -Math.PI / 2; cone.position.z = -0.01; wf.add(cone);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.035, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), STD({ color: 0x1a1a1a, roughness: 0.4 })); cap.rotation.x = Math.PI / 2; cap.position.z = 0.0; wf.add(cap);
  speakerCones.push(wf);
  const tw = new THREE.Group(); tw.position.set(0, 0.44, 0.19); g.add(tw);
  tw.add(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 28), STD({ color: 0x9a9da2, metalness: 0.9, roughness: 0.3, envMapIntensity: 1 })));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), STD({ color: 0xd8c9a0, metalness: 0.6, roughness: 0.25, envMapIntensity: 1 })); dome.rotation.x = Math.PI / 2; tw.add(dome);
  const port = cyl(0.028, 0.028, 0.02, STD({ color: 0x050505 }), 0.1, 0.06, 0.18, g, 18); port.rotation.x = Math.PI / 2;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8cff9a })); led.position.set(-0.13, 0.06, 0.19); g.add(led);
  return g;
}
for (const x of [1.1, 4.1]) { // stands + monitors toed-in towards the sofa
  cyl(0.16, 0.18, 0.025, mBlackMetal, x, 0.013, 2.95, scene, 28); cyl(0.035, 0.035, 0.66, mBlackMetal, x, 0.35, 2.95, scene, 14); box(0.3, 0.02, 0.3, mBlackMetal, x, 0.69, 2.95);
  monitor(x, 0.7, 2.95, x < 2 ? 0.18 : -0.18);
}
// wall-mounted speakers for the shop floor
monitor(0.22, 2.35, 9.45, Math.PI / 2 + 0.5, 0.7); monitor(10.6, 2.6, 3.0, -Math.PI / 2 - 0.4, 0.7);
frameHooks.push(dt => { const on = window.__musicLevel || 0; const t = performance.now() / 1000; const k = on ? 1 + 0.06 * Math.max(0, Math.sin(t * Math.PI * 2 * 2.0)) ** 4 : 1; for (const c of speakerCones) c.scale.set(1, 1, k); });
// console details: tonearms, mixer knobs and faders
for (const x of [2.15, 3.05]) { const ax = x + 0.17, az = 2.95 - 0.11; cyl(0.025, 0.03, 0.03, mSteel, ax, 0.935, az, scene, 18);
  const arm = new THREE.Group(); arm.position.set(ax, 0.958, az); arm.rotation.y = 0.55; scene.add(arm);
  const a = cyl(0.005, 0.005, 0.23, mSteel, 0, 0, 0.105, arm, 8); a.rotation.x = Math.PI / 2; box(0.022, 0.008, 0.035, mBlackMetal, 0, -0.004, 0.225, arm); const cw = cyl(0.016, 0.016, 0.03, mBlackMetal, 0, 0, -0.035, arm, 14); cw.rotation.x = Math.PI / 2;
  box(0.018, 0.004, 0.09, mBlackMetal, x - 0.17, 0.922, 2.95 + 0.06); // pitch fader
}
for (let i = 0; i < 3; i++) for (const sx of [-0.08, 0.08]) cyl(0.011, 0.011, 0.016, STD({ color: 0xd7d2c8, roughness: 0.4 }), 2.6 + sx, 0.948, 2.86 + i * 0.05, scene, 12);
box(0.012, 0.008, 0.06, STD({ color: 0xeeeeee }), 2.6, 0.944, 3.04);
{ const n = 1100, im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.31, 0.31, 1), STD({ roughness: 0.7 }), n), o = new THREE.Object3D(), c = new THREE.Color(); let k = 0;
  const pal = [0x161616, 0xF2EADA, 0x4A1C26, 0xc9874a, 0x283845, 0xd9534f, 0xe9d8a6, 0x2f8f83, 0x1b1b1b, 0x8a7f72];
  for (const y of [0.4, 0.8, 1.2]) { box(0.36, 0.02, 2.8, mOak, 0.19, y, 4.4); let z = 3.05; while (z < 5.75 && k < n) { const w = 0.004 + rnd() * 0.006; o.position.set(0.19, y + 0.168, z + w / 2); o.scale.set(1, 1, w); o.rotation.set(0, 0, 0); o.updateMatrix(); im.setMatrixAt(k, o.matrix); c.setHex(pick(pal)).multiplyScalar(0.75 + rnd() * 0.35); im.setColorAt(k, c); k++; z += w + 0.0015; } }
  im.count = k; scene.add(im);
  for (const [y, z, i] of [[0.4, 3.6, 3], [0.8, 4.9, 7], [1.2, 3.9, 11]]) { const r = box(0.006, 0.31, 0.31, coverMats[i], 0.36, y + 0.168, z, scene, false); r.rotation.z = 0.12; } }
box(3.3, 0.012, 2.3, STD({ color: 0x7a3e2a, roughness: 1 }), 2.8, 0.006, 4.6, scene, false);
box(0.6, 0.38, 0.34, mOak, 3.0, 0.19, 4.55);

// acoustic felt baffles hanging under the dark ceiling (shop + lounge)
{ const n = 26, im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.32, 2.2), STD({ color: 0x3e1620, roughness: 1 }), n), o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { const x = 0.6 + (i % 13) * 0.42, z = i < 13 ? 8.3 : 4.3; o.position.set(x, 2.94, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } scene.add(im); }
// glass shelf with glasses above the taps, bottles on the bar back
{ box(2.8, 0.03, 0.22, STD({ color: 0xcfe3e8, transparent: true, opacity: 0.4, roughness: 0.05 }), 9.4, 1.92, 9.72, scene, false);
  const gl = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.038, 0.03, 0.15, 14, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide }), 26), o = new THREE.Object3D();
  for (let i = 0; i < 26; i++) { o.position.set(8.1 + i * 0.105, 2.01, 9.72); o.updateMatrix(); gl.setMatrixAt(i, o.matrix); } scene.add(gl); }
// gig posters on the left wall above the cover wall
const posterTex = ['TAPE TALES · LIVE', 'DJ SET VINILE', 'FIERA DELLE FANZINE', 'TAP TAKEOVER'].map((t, i) => textTex([{ text: ['SAB', 'VEN', 'DOM', 'GIO'][i], size: 60, color: ['#EEA640', '#F2EADA', '#161616', '#F2EADA'][i], lh: 1.4 }, { text: t, size: 40, color: ['#F2EADA', '#EEA640', '#4A1C26', '#EEA640'][i], lh: 1.3 }, { text: 'SOTTOPORTICO', size: 28, color: ['#F2EADA', '#F2EADA', '#161616', '#F2EADA'][i], mono: true, weight: 500, lh: 2 }], 360, 500, ['#4A1C26', '#161616', '#EEA640', '#2f5d62'][i]));
posterTex.forEach((t, i) => { box(0.03, 0.74, 0.54, mBlackMetal, 0.02, 2.55, 6.95 + i * 0.68, scene, false); plane(0.5, 0.7, STD({ map: t }), 0.04, 2.55, 6.95 + i * 0.68, Math.PI / 2); });
// headphones on hooks at the listening stations
for (let k = 0; k < 2; k++) { const h = makeHeadphones_late(); h.position.set(0.05, 1.45, 7.6 + k * 1.3 + 0.25); h.rotation.set(0, Math.PI / 2, 0); }
// bar stools at the short side of the counter
for (const z of [8.2, 8.75]) { cyl(0.19, 0.19, 0.05, mOak, 7.4, 0.76, z, scene, 24); cyl(0.022, 0.022, 0.74, mBlackMetal, 7.4, 0.37, z, scene, 10); const r = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 24), mBlackMetal); r.rotation.x = Math.PI / 2; r.position.set(7.4, 0.3, z); scene.add(r); cyl(0.2, 0.22, 0.02, mBlackMetal, 7.4, 0.01, z, scene, 24); }

// editoria: bookshelves on back wall, fanzine mesh wall, novelty table
{ const bg = new THREE.BoxGeometry(1, 1, 1); const n = 900; const im = new THREE.InstancedMesh(bg, STD({ roughness: 0.75 }), n); const o = new THREE.Object3D(), c = new THREE.Color(); let k = 0;
  const pal = [0x4A1C26, 0xF2EADA, 0x283845, 0xc9874a, 0x1b1b1b, 0x7d8c5c, 0xd9534f, 0xe9d8a6, 0x3d5a80, 0x9a8c98];
  for (const y of [0.3, 0.75, 1.2, 1.65, 2.1]) { box(4.6, 0.03, 0.32, mOak, 8.1, y, 0.17); let x = 5.9; while (x < 10.35 && k < n) { const w = 0.022 + rnd() * 0.035, h = 0.22 + rnd() * 0.13; o.position.set(x + w / 2, y + 0.015 + h / 2, 0.16); o.scale.set(w, h, 0.2 + rnd() * 0.04); o.rotation.z = rnd() < 0.04 ? 0.25 : 0; o.updateMatrix(); im.setMatrixAt(k, o.matrix); c.setHex(pick(pal)).multiplyScalar(0.8 + rnd() * 0.3); im.setColorAt(k, c); k++; x += w + 0.003; } }
  im.count = k; im.castShadow = true; im.receiveShadow = true; scene.add(im); }
box(0.025, 2.2, 3.6, mBlackMetal, 5.35, 1.4, 2.0);
for (let i = 0; i < 16; i++) { const z = 0.45 + (i % 8) * 0.42, y = 0.9 + Math.floor(i / 8) * 0.8; plane(0.21, 0.29, coverMats[(i * 3) % 16], 5.38, y, z, Math.PI / 2); }
const zineTex = textTex([{ text: 'FANZINE', size: 80, color: '#F2EADA' }], 480, 120, '#161616');
plane(1.2, 0.3, STD({ map: zineTex }), 5.39, 2.32, 1.9, Math.PI / 2);
box(1.8, 0.045, 0.9, mOak, 8.0, 0.85, 2.5); for (const [a, b] of [[-0.82, -0.38], [0.82, -0.38], [-0.82, 0.38], [0.82, 0.38]]) box(0.045, 0.83, 0.045, mBlackMetal, 8.0 + a, 0.415, 2.5 + b);
for (let i = 0; i < 14; i++) { const b = box(0.16, 0.025 + rnd() * 0.04, 0.22, coverMats[(i * 7) % 16], 7.25 + (i % 7) * 0.24, 0.89, 2.25 + Math.floor(i / 7) * 0.45); b.rotation.y = (rnd() - 0.5) * 0.3; }

// ---------------- collision map: walls, counters, furniture (live mode pathfinding) ----------------
{
  obBox(-0.3, -0.3, 11.2, 0.05); obBox(-0.3, -0.3, 0.05, 10.2);            // back + left walls
  obBox(-0.3, 9.88, 5.55, 10.2); obBox(6.85, 9.88, 11.25, 10.25);           // front glazing, door gap 5.6..6.8, blind corner
  obBox(10.9, -0.3, 11.25, 10.25);                                          // side glazing / corner
  obBox(-0.3, -0.3, 5.3, 2.6);                                              // storage + WC
  obBox(7.85, 7.25, 10.95, 7.95); obBox(7.6, 7.25, 8.3, 8.75); obBox(8.3, 7.95, 10.95, 9.95); // bar counter + staff area
  obCirc(7.4, 8.2, 0.25); obCirc(7.4, 8.75, 0.25);                          // stools
  obBox(7.95, 4.0, 10.65, 4.9);                                             // fridges
  for (const [x, z] of [[1.2, 9.2], [2.8, 9.2], [4.4, 9.2], [1.2, 7.3], [2.8, 7.3], [4.4, 7.3]]) obBox(x - 0.68, z - 0.3, x + 0.68, z + 0.3); // vinyl bins
  obBox(-0.1, 7.2, 0.55, 8.0); obBox(-0.1, 8.5, 0.55, 9.3);                 // listening stations
  obCirc(0.55, 6.15, 0.4); obCirc(5.0, 3.0, 0.38); obCirc(10.5, 0.6, 0.45); // potted plants
  obBox(1.55, 2.6, 3.65, 3.25); obBox(0.85, 2.7, 1.35, 3.2); obBox(3.85, 2.7, 4.35, 3.2); obBox(-0.1, 2.9, 0.4, 5.9); // console, speakers, record shelf
  obBox(1.3, 5.05, 3.3, 6.05); obCirc(0.95, 4.4, 0.5); obBox(4.45, 3.75, 5.25, 5.45); obBox(2.7, 4.38, 3.3, 4.72); // sofa, armchairs, coffee table
  obBox(5.8, -0.1, 10.4, 0.36); obBox(5.3, 0.2, 5.42, 3.85); obBox(7.05, 2.0, 8.95, 3.0); obCirc(10.2, 3.3, 0.45); // books, zines, table, reading chair
  for (let x = -8; x <= 14; x += 4.4) obBox(x - 0.32, 13.88, x + 0.32, 14.52);  // portico columns
  for (const z of [-1, 3.5, 8]) obBox(13.98, z - 0.32, 14.62, z + 0.32);
  obBox(14.7, -2, 15.1, 14.6); obBox(-9.5, 9.9, -9.0, 14.6);                // corridor wall, portico end wall
  obCirc(7.1, 11.0, 0.42); obBox(-8.8, 12.8, -8.2, 14.0);                   // A-frame, bike
}

// ---------------- outdoor furniture ----------------
const tables = [[0.4, 12.0], [3.2, 12.4], [-2.6, 12.2], [-5.6, 12.0], [12.8, 8.2], [10.4, 12.6]];
tables.forEach(([x, z]) => { bistroTable(x, z); obCirc(x, z, 0.42); });
// free seats for live players: chairs around the empty tables + lounge armchair + reading chair + piazza benches
for (const [tx, tz, n] of [[-5.6, 12.0, 3], [10.4, 12.6, 2]]) for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * (Math.PI * 2 / n); const x = tx + Math.cos(a) * 0.52, z = tz + Math.sin(a) * 0.52; const ry = Math.atan2(tx - x, tz - z); bistroChair(x, z, ry); seats.push({ x, z, ry, kind: 'table' }); obCirc(x, z, 0.24); }
seats.push({ x: 0.95, z: 4.4, ry: Math.PI * 0.62, kind: 'chair' }, { x: 10.2, z: 3.3, ry: -Math.PI * 0.8, kind: 'chair' }, { x: 10.6, z: 27.5, ry: -Math.PI / 2, kind: 'chair' }, { x: 10.6, z: 28.5, ry: -Math.PI / 2, kind: 'chair' }, { x: 21.3, z: 40, ry: Math.PI / 2, kind: 'chair' });

// ---------------- GLTF models ----------------
async function glb(name) { const g = await gltfL.parseAsync(await b64buf(A + 'models/' + name + '.b64.json'), ''); g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = 0.7; const ga = o.geometry.attributes; if (ga.uv && !ga.uv1) o.geometry.setAttribute('uv1', ga.uv); if (ga.uv && !ga.uv2) o.geometry.setAttribute('uv2', ga.uv); } }); return g; }
function fit(obj, { h, w }) { const b = new THREE.Box3().setFromObject(obj), s = new THREE.Vector3(); b.getSize(s); const k = h ? h / s.y : w / Math.max(s.x, s.z); obj.scale.multiplyScalar(k); const b2 = new THREE.Box3().setFromObject(obj); obj.userData.base = -b2.min.y; return obj; }
function place(obj, x, y, z, ry = 0) { const w = new THREE.Group(); w.add(obj); obj.position.y += obj.userData.base || 0; w.position.set(x, y, z); w.rotation.y = ry; scene.add(w); return w; }
const fridgeMixers = [];
async function loadModels() {
  const [fr, plant, sofa, chairD, sheen, barn, vase, velvet] = await Promise.all(['CommercialRefrigerator', 'DiffuseTransmissionPlant', 'SheenWoodLeatherSofa', 'ChairDamaskPurplegold', 'SheenChair', 'AnisotropyBarnLamp', 'GlassVaseFlowers', 'GlamVelvetSofa'].map(glb));
  const fridgeHead = textTex([{ text: 'LATTINE FRESCHE', size: 56, color: '#F2EADA', mono: true, weight: 500 }], 640, 110, '#4A1C26');
  // fridges: 3 units on wall z≈4.3 facing +z
  for (let i = 0; i < 3; i++) {
    const g = i === 0 ? fr : await glb('CommercialRefrigerator');
    const s = g.scene; const bott = s.getObjectByName('ChampagneBottles'); if (bott) bott.visible = false;
    fit(s, { h: 2.0 }); const w = place(s, 8.45 + i * 0.85, 0, 4.45, 0);
    const bb = new THREE.Box3().setFromObject(w); w.userData.bb = bb;
    // cans inside
    const inner = { x0: bb.min.x + 0.08, x1: bb.max.x - 0.08, z: (bb.min.z + bb.max.z) / 2 - 0.05 };
    const o = new THREE.Object3D();
    for (const [ly, k0] of [[0.42, 0], [0.82, 1], [1.22, 2], [1.6, 3]]) { const m = canMats[(k0 + i * 2) % canMats.length]; const cnt = Math.floor((inner.x1 - inner.x0) / 0.075) * 3; const im = new THREE.InstancedMesh(canGeo, m, cnt); let k = 0; for (let x = inner.x0; x < inner.x1 && k < cnt; x += 0.075) for (let d = 0; d < 3; d++) { o.position.set(x, ly + 0.061, inner.z - 0.1 + d * 0.1); o.updateMatrix(); im.setMatrixAt(k++, o.matrix); } im.count = k; scene.add(im); }
    pl((bb.min.x + bb.max.x) / 2, 1.2, bb.max.z - 0.2, 1.2, 1.4, 0xeaf2ff);
    plane(bb.max.x - bb.min.x - 0.04, 0.24, STD({ map: fridgeHead, emissive: 0xffffff, emissiveMap: fridgeHead, emissiveIntensity: 0.5 }), (bb.min.x + bb.max.x) / 2, bb.max.y - 0.14, bb.max.z + 0.012);
    if (g.animations.length && i === 1) { const mx = new THREE.AnimationMixer(s); const a = mx.clipAction(g.animations[0]); a.setLoop(THREE.LoopPingPong); a.play(); fridgeMixers.push(mx); }
  }
  const frTex = textTex([{ text: 'FRIGO DA ASPORTO · LATTINE', size: 52, color: '#F2EADA', mono: true, weight: 500 }], 1100, 120, '#4A1C26');
  plane(2.4, 0.26, STD({ map: frTex, emissive: 0xffffff, emissiveMap: frTex, emissiveIntensity: 0.25 }), 9.3, 2.35, 4.75);
  // plants
  const pl1 = fit(plant.scene, { h: 1.5 }); place(pl1, 0.55, 0, 6.15, 0.5);
  for (const [x, z, h] of [[5.0, 3.0, 1.3], [10.5, 0.6, 1.6]]) { const c = fit(plant.scene.clone(true), { h }); place(c, x, 0, z, rnd() * 6); }
  // lounge seating
  const sf = fit(sofa.scene, { w: 2.0 }); place(sf, 2.3, 0, 5.55, Math.PI);
  const ch1 = fit(chairD.scene, { h: 0.95 }); place(ch1, 0.95, 0, 4.4, Math.PI * 0.62);
  const ch2 = fit(velvet.scene, { w: 1.7 }); place(ch2, 4.85, 0, 4.6, -Math.PI / 2);
  // reading chair in editoria
  const sc = fit(sheen.scene, { h: 0.85 }); place(sc, 10.2, 0, 3.3, -Math.PI * 0.8);
  // barn lamps over the signs (outside)
  for (const [x, z, ry] of [[8.0, 10.2, 0], [10.2, 10.2, 0]]) { const b = fit(barn.scene.clone(true), { w: 0.42 }); place(b, x, 3.0, z + 0.05, ry); }
  // flowers on the counter
  const vs = fit(vase.scene, { h: 0.42 }); place(vs, 10.5, 1.1, 7.55, 0);
}

// ---------------- people ----------------
const clips = {};
let clipData = null;
async function clip(name) { if (!clipData) clipData = fetch(A + 'clips.json').then(r => r.json()); if (!clips[name]) clips[name] = clipData.then(d => { const c = THREE.AnimationClip.parse(d[name]); c.uuid = THREE.MathUtils.generateUUID(); for (const t of c.tracks) if (t.name === 'Bip01.position') for (let i = 0; i < t.values.length; i += 3) { t.values[i] = 0; t.values[i + 2] = 0; } return c; }); return clips[name]; }
const mixers = [];
const _avBuf = {}, _avImg = {}, _avTex = {};
async function loadAvatar(n) {
  _avBuf[n] ||= b64buf(A + 'pp/' + n + '.b64.json');
  if (!_avTex[n]) _avImg[n] ||= new Promise((res, rej) => new THREE.ImageLoader(manager).load(A + 'pp/' + n + '.jpg', res, undefined, rej));
  const fbx = fbxL.parse((await _avBuf[n]).slice(0), '');
  // split the atlas once per character into 4 quadrant textures (shared by every instance); smaller on phones
  if (!_avTex[n]) {
    const atlasImg = await _avImg[n];
    const S = isMobile ? 384 : 1024, hw = atlasImg.width / 2, hh = atlasImg.height / 2;
    const q = (qx, qy, srgb) => { const cv = document.createElement('canvas'); cv.width = cv.height = S; cv.getContext('2d').drawImage(atlasImg, qx * hw, qy * hh, hw, hh, 0, 0, S, S); const t = new THREE.CanvasTexture(cv); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = isMobile ? 1 : 4; return t; };
    if (!_avTex[n]) _avTex[n] = { bc: q(0, 0, true), hc: q(1, 0, true), bn: q(0, 1, false), op: q(1, 1, false) };
    delete _avImg[n]; // free the full-size atlas
  }
  const { bc, hc, bn, op } = _avTex[n];
  const mBody = new THREE.MeshStandardMaterial({ map: bc, normalMap: bn, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.78, envMapIntensity: 0.3 });
  const mHead = new THREE.MeshStandardMaterial({ map: hc, roughness: 0.62, envMapIntensity: 0.5 });
  const mOp = new THREE.MeshStandardMaterial({ map: hc, alphaMap: op, alphaTest: 0.35, transparent: false, side: THREE.DoubleSide, roughness: 0.7, envMapIntensity: 0.4 });
  fbx.traverse(m => {
    if (m.isMesh) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const nm = mats.map(x => { const s = (x.name || '').toLowerCase(); return s.includes('head') ? mHead : s.includes('opacity') ? mOp : mBody; });
      m.material = nm.length === 1 ? nm[0] : nm; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    }
  });
  return fbx;
}
function attachProp(fbx, side, kind) {
  const L = fbx.getObjectByName('Bip01_L_Hand'), R = fbx.getObjectByName('Bip01_R_Hand');
  const bone = side === 'L' ? L : R; if (!bone || !kind) return null; let p;
  if (kind === 'can' || kind === 'cup') { p = kind === 'can' ? makeCan() : makeCup(); p.scale.setScalar(100); p.rotation.x = Math.PI / 2; p.position.set(6.5, bone === L ? -3.5 : 3.5, 0); }
  if (kind === 'bag') { p = makeBag(); p.scale.setScalar(100); p.rotation.z = Math.PI / 2; p.position.set(6, 0, 0); }
  if (kind === 'record') { p = makeRecord(); p.scale.setScalar(100); p.position.set(9, bone === L ? -2 : 2, 0); p.rotation.set(0, 0, 0.3); }
  if (kind === 'book') { p = makeBook(); p.scale.setScalar(100); p.position.set(8, bone === L ? -4 : 4, 0); p.rotation.set(Math.PI / 2, 0, 0); }
  p.traverse(m => { if (m.isMesh) m.castShadow = true; }); bone.add(p); return p;
}
function attachHeadphones(fbx) { const H = fbx.getObjectByName('Bip01_Head'); if (!H) return null; const hp = makeHeadphones(); hp.scale.setScalar(100); hp.position.set(8, 0, 0); hp.rotation.set(0, 0, -Math.PI / 2); H.add(hp); return hp; }
async function person(o) {
  const n = o.who;
  const fbx = await loadAvatar(n);
  fbx.scale.setScalar(0.01 * (o.scale || 1));
  const g = new THREE.Group(); g.add(fbx); g.position.set(o.x, o.y || 0, o.z); g.rotation.y = o.ry || 0; scene.add(g);
  const c = await clip(o.anim);
  const mx = new THREE.AnimationMixer(fbx); const act = mx.clipAction(c); act.setLoop(THREE.LoopPingPong); act.play(); mx.setTime(rnd() * c.duration); mx.timeScale = 0.9 + rnd() * 0.2; mixers.push(mx);
  if (o.R) attachProp(fbx, 'R', o.R); if (o.L) attachProp(fbx, 'L', o.L);
  if (o.headphones) attachHeadphones(fbx);
  npcs.push({ who: n, group: g });
  if (o.seat) bistroChair(o.x, o.z, o.ry || 0);
  obCirc(o.x, o.z, o.seat ? 0.32 : 0.28);
  return g;
}
const PI = Math.PI;
const people = [
  // --- outside, tables
  { who: 'Male_Adult_06', anim: 'm_sit_table_idle_relaxed_01', x: 0.4, z: 11.5, ry: 0, seat: 1, R: 'can' },
  { who: 'Female_Adult_03', anim: 'f_sit_table_gestic_shrug_01', x: 0.93, z: 12.35, ry: -PI / 2 - 0.35, seat: 1, R: 'cup' },
  { who: 'Female_Adult_01', anim: 'f_sit_table_idle_relaxed_01', x: -0.13, z: 12.4, ry: PI / 2 + 0.35, seat: 1, R: 'cup' },
  { who: 'Female_Adult_12', anim: 'f_sit_table_idle_relaxed_01', x: 2.72, z: 12.1, ry: PI / 2 - 0.3, seat: 1, R: 'can' },
  { who: 'Male_Adult_10', anim: 'm_sit_table_gestic_thoughtful', x: 3.7, z: 12.1, ry: -PI / 2 + 0.3, seat: 1 },
  { who: 'Male_Adult_12', anim: 'm_sit_table_idle_relaxed_01', x: -2.6, z: 11.68, ry: 0, seat: 1, R: 'can' },
  { who: 'Female_Adult_05', anim: 'f_sit_table_idle_relaxed_01', x: -2.6, z: 12.72, ry: PI, seat: 1, R: 'cup' },
  { who: 'Male_Adult_13', anim: 'm_sit_table_idle_relaxed_01', x: 12.8, z: 7.68, ry: 0, seat: 1, R: 'cup' },
  { who: 'Female_Adult_13', anim: 'f_sit_table_idle_relaxed_01', x: 12.8, z: 8.72, ry: PI, seat: 1, R: 'can' },
  // --- outside, standing group
  { who: 'Male_Adult_04', anim: 'm_drink_drinking', x: 6.5, z: 11.6, ry: -2.3, R: 'cup' },
  { who: 'Female_Adult_07', anim: 'f_hold_bag_talk', x: 7.25, z: 11.15, ry: 2.6, L: 'bag' },
  { who: 'Male_Adult_16', anim: 'm_gestic_talk_relaxed_01', x: 7.35, z: 12.1, ry: 3.7, R: 'can' },
  { who: 'Female_Adult_04', anim: 'f_drink_idle', x: -5.0, z: 13.2, ry: -0.6, R: 'can' },
  { who: 'Male_Adult_01', anim: 'm_hold_bag_idle', x: -5.8, z: 12.9, ry: 0.8, R: 'bag' },
  // --- bar + cassa
  { who: 'Male_Adult_09', anim: 'm_work_table', x: 8.4, z: 8.35, ry: PI },
  { who: 'Female_Adult_08', anim: 'f_idle_neutral_01', x: 8.45, z: 6.95, ry: 0.1, L: 'record' },
  { who: 'Female_Adult_09', anim: 'f_work_table', x: 9.8, z: 9.15, ry: 0 },
  { who: 'Male_Adult_11', anim: 'm_drink_drinking', x: 9.7, z: 6.95, ry: 0.15, R: 'cup' },
  { who: 'Female_Adult_14', anim: 'f_drink_idle', x: 10.4, z: 7.0, ry: -0.35, R: 'cup' },
  // --- fridge
  { who: 'Male_Adult_07', anim: 'm_try_door_outwards', x: 9.3, z: 5.45, ry: PI },
  { who: 'Female_Adult_11', anim: 'f_idle_look_around_01', x: 8.2, z: 5.6, ry: PI - 0.3, R: 'can' },
  // --- vinyl
  { who: 'Male_Adult_02', anim: 'm_work_mid', x: 1.25, z: 8.6, ry: PI },
  { who: 'Female_Adult_15', anim: 'f_work_table', x: 2.9, z: 8.62, ry: PI - 0.15 },
  { who: 'Female_Adult_10', anim: 'f_headphones_idle', x: 0.85, z: 7.6, ry: -PI / 2, headphones: 1 },
  { who: 'Male_Adult_14', anim: 'm_headphones_idle', x: 0.85, z: 8.9, ry: -PI / 2 + 0.2, headphones: 1 },
  { who: 'Male_Adult_05', anim: 'm_hold_bag_idle', x: 6.0, z: 7.9, ry: 2.3, R: 'bag' },
  // --- lounge
  { who: 'Male_Adult_08', anim: 'm_sit_chair_idle_relaxed_01', x: 1.9, z: 5.35, ry: PI },
  { who: 'Female_Adult_02', anim: 'f_sit_chair_idle_relaxed_01', x: 2.75, z: 5.35, ry: PI, R: 'cup' },
  { who: 'Male_Adult_03', anim: 'm_sit_chair_breathe_01', x: 4.8, z: 4.6, ry: -PI / 2, R: 'can' },
  { who: 'Male_Adult_15', anim: 'm_work_table', x: 2.6, z: 3.45, ry: PI, headphones: 1 },
  // --- editoria
  { who: 'Female_Adult_06', anim: 'f_newspaper_hand_idle', x: 8.0, z: 3.3, ry: PI, R: 'book' },
  { who: 'Male_Adult_10', anim: 'm_newspaper_hand_idle', x: 9.4, z: 1.0, ry: PI * 0.9, R: 'book' },
  { who: 'Female_Adult_04', anim: 'f_idle_look_around_01', x: 6.3, z: 1.4, ry: -PI / 2 + 0.2 },
];

// ---------------- tour ----------------
const stops = [
  { t: 'Piazzale Bestat', d: 'Dalla piazza pedonale, tra le aiuole e il pavimento a zig-zag: sotto la torre a lamelle di Piccinato il portico si accende. Le vetrine del Sottoportico guardano la Biblioteca Acclavio.', p: [14, 1.7, 31], l: [6.5, 2.2, 12] },
  { t: 'Sotto il portico', d: 'Fioriere tra le colonne, gelsomino rampicante, lucine sopra i tavolini e la lavagna con la serata. Lattine e bicchieri in mano, buste di dischi appena comprati.', p: [13.3, 1.7, 13.6], l: [6.5, 1.2, 10.8] },
  { t: 'I tavolini', d: 'Una birra prima di entrare, o dopo: chi chiacchiera al tavolo, chi è già uscito con il disco nella busta.', p: [3.0, 1.6, 13.55], l: [-0.6, 0.9, 11.6] },
  { t: 'Di fronte, la biblioteca', d: 'Di fronte al locale, oltre la piazza, il tamburo bianco a lamelle della Biblioteca Acclavio, sollevato sui pilotis tra le aiuole: libri di qua, libri di là.', p: [8.5, 1.7, 15.4], l: [-4, 4.5, 46] },
  { t: 'Bancone e cassa', d: 'Appena entrati, il bancone dietro l\'angolo cieco: il cassiere batte un vinile, la barista lavora alle spine, al banco si beve in piedi.', p: [6.1, 1.65, 6.1], l: [9.0, 1.1, 8.1] },
  { t: 'Il frigo delle lattine', d: 'Il frigo da asporto: si apre l\'anta, si sceglie la lattina, si paga in cassa.', p: [10.8, 1.7, 6.6], l: [8.9, 1.0, 4.4] },
  { t: 'Il negozio di vinili', d: 'Contenitori in legno divisi per genere. Chi sfoglia, chi ascolta in cuffia alle postazioni prima di comprare.', p: [6.0, 1.7, 6.6], l: [2.0, 0.9, 8.3] },
  { t: 'La listening lounge', d: 'In fondo, lontano dal portico: divano in pelle, poltrone, feltro alle pareti. Il selector mette il lato A e si ascolta fino alla fine.', p: [4.8, 1.75, 7.0], l: [2.5, 0.8, 3.6] },
  { t: 'La parete della carta', d: 'Piccoli editori, riviste e la rete delle fanzine. Il tavolo delle novità è a due passi dalla birra.', p: [6.0, 1.7, 4.0], l: [9.0, 1.0, 1.3] },
];
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.rotateSpeed = -0.35;
controls.minDistance = 0.4; controls.maxDistance = 5; controls.maxPolarAngle = Math.PI * 0.64; controls.minPolarAngle = Math.PI * 0.25;
let cur = 0, anim = null;
const elStep = document.getElementById('step'), elT = document.getElementById('title'), elD = document.getElementById('desc'), dots = document.getElementById('dots');
stops.forEach((s, i) => { const b = document.createElement('button'); b.setAttribute('aria-label', `Tappa ${i + 1}: ${s.t}`); b.onclick = () => { stopAuto(); go(i); }; dots.appendChild(b); });
function setText(i) { const s = stops[i]; elStep.textContent = `TAPPA ${i + 1} / ${stops.length}`; elT.textContent = s.t; elD.textContent = s.d; [...dots.children].forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false')); }
function frame(i) { const s = stops[i]; const p = new THREE.Vector3(...s.p), l = new THREE.Vector3(...s.l); const dir = l.clone().sub(p).normalize(); return { p, target: p.clone().add(dir.multiplyScalar(1.2)) }; }
const inside = v => v.z < 10 && v.x < 11 && v.y > -0.5;
const below = v => v.y < -0.5;
function go(i) {
  cur = (i + stops.length) % stops.length; setText(cur); const to = frame(cur);
  anim = { t: 0, dur: 2.6, p0: camera.position.clone(), t0: controls.target.clone(), p1: to.p, t1: to.target, via: null };
  if (inside(anim.p0) !== inside(anim.p1)) anim.via = new THREE.Vector3(6.2, 1.7, 10.6);
  else if (below(anim.p0) !== below(anim.p1)) anim.via = new THREE.Vector3(8, 2.2, 17.5);
}
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
document.getElementById('next').onclick = () => { stopAuto(); go(cur + 1); };
document.getElementById('prev').onclick = () => { stopAuto(); go(cur - 1); };
let autoTimer = null; const playBtn = document.getElementById('play');
function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; playBtn.textContent = '▶ Auto'; playBtn.setAttribute('aria-pressed', 'false'); } }
playBtn.onclick = () => { if (autoTimer) { stopAuto(); return; } playBtn.textContent = '❚❚ Pausa'; playBtn.setAttribute('aria-pressed', 'true'); go(cur + 1); autoTimer = setInterval(() => go(cur + 1), 8000); };
const cred = document.getElementById('credits');
document.getElementById('credBtn').onclick = () => cred.setAttribute('open', ''); document.getElementById('credClose').onclick = () => cred.removeAttribute('open');
window.__tourJump = i => { cur = i; setText(i); const f = frame(i); anim = null; camera.position.copy(f.p); controls.target.copy(f.target); controls.update(); };

// post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
let gtao = null; if (!isMobile) { try { gtao = new GTAOPass(scene, camera, innerWidth, innerHeight); gtao.blendIntensity = 0.85; gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.2, thickness: 1.2, scale: 1 }); composer.addPass(gtao); } catch (e) { gtao = null; } }
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.15, 0.4, 2.0); if (!isMobile) composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 72 : 58; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------------- boot ----------------
(async () => {
  try {
    try { await Promise.race([Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('500 40px "IBM Plex Mono"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
    flushCards();
    lmsg.textContent = 'Arredo il locale…';
    await loadModels();
    lmsg.textContent = 'Arrivano le persone…';
    let done = 0;
    const crowd = isMobile ? people.filter((p, i) => i % 2 === 0 || p.anim.includes('work')) : people;
    const tick = () => { done++; lmsg.textContent = `Arrivano le persone… ${done}/${crowd.length}`; };
    if (isMobile) { for (const p of crowd) { await person(p); tick(); } } // one at a time on phones: lower memory peak
    else await Promise.all(crowd.map(p => person(p).then(tick)));
    lmsg.textContent = 'Quasi pronto…';
    await new Promise(r => { if (manager.itemsLoaded >= manager.itemsTotal) r(); else { const prev = manager.onLoad; manager.onLoad = () => { prev && prev(); r(); }; setTimeout(r, 15000); } });
    lmsg.textContent = 'Preparo la scena…';
    if (isMobile) capTextures(1024);
    await new Promise(r => setTimeout(r, 30));
    const f0 = frame(0); camera.position.copy(f0.p).add(new THREE.Vector3(0, 4, 8)); controls.target.copy(f0.target);
    document.getElementById('loading').remove();
    showModes();
    window.__ready = true;
    if (!window.__manual) loop(); else window.__render();
  } catch (err) { lmsg.textContent = 'Il tour non si è caricato su questo dispositivo: ' + err.message; console.error(err); }
})();

function capTextures(cap) {
  const seen = new Set();
  scene.traverse(o => { if (!o.material) return; for (const m of [].concat(o.material)) for (const k in m) { const t = m[k]; if (!t || !t.isTexture || seen.has(t) || t.isCanvasTexture) continue; seen.add(t); const im = t.image; if (!im || !im.width || Math.max(im.width, im.height) <= cap) continue; const sc = cap / Math.max(im.width, im.height); const cv = document.createElement('canvas'); cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc); try { cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); t.image = cv; t.needsUpdate = true; } catch (e) { } } });
}
const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (anim) {
    anim.t += dt / anim.dur; const k = ease(Math.min(anim.t, 1));
    if (anim.via) { const a = anim.p0, b = anim.via, c = anim.p1, u = 1 - k; camera.position.set(u * u * a.x + 2 * u * k * b.x + k * k * c.x, u * u * a.y + 2 * u * k * b.y + k * k * c.y, u * u * a.z + 2 * u * k * b.z + k * k * c.z); }
    else camera.position.lerpVectors(anim.p0, anim.p1, k);
    controls.target.lerpVectors(anim.t0, anim.t1, k);
    if (anim.t >= 1) anim = null; controls.enabled = !anim;
  }
  for (const m of mixers) m.update(dt);
  for (const h of frameHooks) h(dt);
  for (const m of fridgeMixers) m.update(dt * 0.6);
  for (const s of spinning) s.rotation.y -= dt * 3.5;
  controls.update();
  composer.render();
  if (!window.__manual) requestAnimationFrame(loop);
}
function showModes() {
  const ov = document.getElementById('modes'); ov.hidden = false;
  document.getElementById('mTour').onclick = () => { ov.hidden = true; document.getElementById('panel').hidden = false; go(0); };
  document.getElementById('mLive').onclick = async () => {
    ov.hidden = true; const m = await import('./live.js');
    m.start({ THREE, A, scene, camera, controls, renderer, canvas, frameHooks, mixers, clip, loadAvatar, attachProp, attachHeadphones, textTex, canvasTex, coverTex, walkables, seats, npcs, spinning, isMobile, obstacles, LIB: { x: LIB.x, z: LIB.z, r: LR } });
  };
}
window.__mode = (k) => document.getElementById(k === 'live' ? 'mLive' : 'mTour').click();
window.__cam = (p, l) => { camera.position.set(...p); controls.target.set(...l); controls.update(); };
window.__render = () => { anim = null; for (const m of mixers) m.update(0.016); for (const h of frameHooks) h(0.016); controls.update(); composer.render(); };
window.__step = (n, dt = 0.05) => { for (let i = 0; i < n; i++) { for (const m of mixers) m.update(dt); for (const h of frameHooks) h(dt); } controls.update(); composer.render(); };
