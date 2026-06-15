// ── Plant Library ──
// The desert catalog. One specimen at a time stands large and centered,
// rendered as a translucent botanical-ink scan on paper; the filmstrip,
// arrows, or ←/→ keys change it. Every plant carries real horticultural
// specs. Built on the same ink shader as the rest of the site.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Accurate Sonoran-desert horticulture for each scanned specimen.
const PLANTS = [
  { id: 'agave-americana',     common: 'Century Plant',        latin: 'Agave americana',
    size: '6 ft × 8–10 ft', sun: 'Full sun',  water: 'Very low', hardy: '15°F' },
  { id: 'agave-truncata',      common: 'Artichoke Agave',      latin: 'Agave parryi v. truncata',
    size: '2 ft × 3 ft',    sun: 'Full sun',  water: 'Very low', hardy: '10°F' },
  { id: 'golden-barrel',       common: 'Golden Barrel',        latin: 'Echinocactus grusonii',
    size: '3 ft × 3 ft',    sun: 'Full sun',  water: 'Very low', hardy: '15°F' },
  { id: 'fire-barrel',         common: 'Fire Barrel',          latin: 'Ferocactus pilosus',
    size: '4 ft × 2 ft',    sun: 'Full sun',  water: 'Very low', hardy: '20°F' },
  { id: 'saguaro-spear',       common: 'Saguaro',              latin: 'Carnegiea gigantea',
    size: 'to 40 ft',       sun: 'Full sun',  water: 'Very low', hardy: '15°F' },
  { id: 'totem-pole',          common: 'Totem Pole Cactus',    latin: 'Pachycereus schottii',
    size: '10–12 ft',       sun: 'Full sun',  water: 'Low',      hardy: '25°F' },
  { id: 'mexican-fence-post',  common: 'Mexican Fence Post',   latin: 'Pachycereus marginatus',
    size: '12–16 ft',       sun: 'Full sun',  water: 'Low',      hardy: '25°F' },
  { id: 'argentine-toothpick', common: 'Argentine Toothpick',  latin: 'Stetsonia coryne',
    size: 'to 25 ft',       sun: 'Full sun',  water: 'Low',      hardy: '20°F' },
];

const wrap = document.getElementById('library-canvas-wrap');
const stage = document.getElementById('library-stage');
const strip = document.getElementById('library-strip');
const commonEl = document.getElementById('library-common');
const latinEl = document.getElementById('library-latin');
const specsEl = document.getElementById('library-specs');
const hintEl = document.getElementById('library-hint');
const prevBtn = document.getElementById('library-prev');
const nextBtn = document.getElementById('library-next');

if (wrap && strip) build();

function build() {
  // ── Filmstrip thumbs (text-based, elegant) ──
  const thumbs = PLANTS.map((p, i) => {
    const b = document.createElement('button');
    b.className = 'library-thumb' + (i === 0 ? ' is-active' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.dataset.i = i;
    b.innerHTML = `<span class="library-thumb-common">${p.common}</span><span class="library-thumb-latin">${p.latin}</span>`;
    b.addEventListener('click', () => select(i));
    strip.appendChild(b);
    return b;
  });

  // ── Renderer ──
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    stage.classList.add('library-no3d');
    select(0);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  wrap.appendChild(renderer.domElement);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  let camY = 0.5;
  camera.position.set(0, camY + 0.16, 2.35);
  camera.lookAt(0, camY, 0);

  // ── Botanical-ink material (shared site language) ──
  const GHOST = {
    uniforms: {
      uFill: { value: new THREE.Color(0x55836a) },
      uRim: { value: new THREE.Color(0x1d3829) },
      uHot: { value: new THREE.Color(0x0f241a) },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFill; uniform vec3 uRim; uniform vec3 uHot;
      uniform float uOpacity; uniform float uSide;
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float ndv = abs(dot(n, v));
        float fres = pow(1.0 - ndv, 2.2);
        float lamb = pow(max(dot(n, normalize(vec3(0.35, 1.0, 0.4))), 0.0), 1.4);
        vec3 col = mix(mix(uFill, uRim, fres), uHot, pow(fres, 3.0) * 0.4);
        col = mix(col, uFill * 1.18, lamb * 0.35);
        float a = (0.07 + 0.6 * fres + 0.05 * lamb) * uSide * uOpacity;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }`,
    blending: THREE.NormalBlending,
    transparent: true,
    depthWrite: false,
  };
  const BACK_GAIN = 0.22;
  const makeGhost = (side, gain) => {
    const m = new THREE.ShaderMaterial({ ...GHOST, uniforms: THREE.UniformsUtils.clone(GHOST.uniforms), side });
    m.uniforms.uSide = { value: gain };
    return m;
  };

  // ── Pedestal: ink rings + soft shadow pool ──
  const pedestal = new THREE.Group();
  {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.0035, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x2e5d43, transparent: true, opacity: 0.55, depthWrite: false })
    );
    ring.rotation.x = Math.PI / 2;
    pedestal.add(ring);
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.002, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x2e5d43, transparent: true, opacity: 0.2, depthWrite: false })
    );
    ring2.rotation.x = Math.PI / 2;
    pedestal.add(ring2);

    const cnv = document.createElement('canvas');
    cnv.width = cnv.height = 256;
    const g = cnv.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(28,42,33,0.26)');
    grad.addColorStop(0.4, 'rgba(28,42,33,0.10)');
    grad.addColorStop(0.75, 'rgba(28,42,33,0.025)');
    grad.addColorStop(1, 'rgba(28,42,33,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cnv), transparent: true, depthWrite: false })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = -0.004;
    pedestal.add(pool);
  }
  scene.add(pedestal);

  // ── Model loading ──
  const loader = new GLTFLoader();
  const cache = new Map();
  const holder = new THREE.Group();
  scene.add(holder);

  function load(id) {
    if (!cache.has(id)) {
      cache.set(id, new Promise((resolve, reject) => {
        loader.load(`assets/models/${id}.glb?v=2`, (gltf) => {
          const group = new THREE.Group();
          const back = makeGhost(THREE.BackSide, BACK_GAIN);
          const front = makeGhost(THREE.FrontSide, 1.0);
          gltf.scene.traverse((o) => {
            if (!o.isMesh) return;
            const b = new THREE.Mesh(o.geometry, back);
            const f = new THREE.Mesh(o.geometry, front);
            b.renderOrder = 1; f.renderOrder = 2;
            group.add(b, f);
          });
          group.userData.mats = [back, front];
          const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
          const half = Math.hypot(Math.max(size.x, size.z) / 2, size.y / 2);
          group.userData.baseScale = 0.62 / Math.max(0.45, half);
          group.userData.footprint = (Math.max(size.x, size.z) / 2) * group.userData.baseScale * 1.12;
          group.userData.centerY = (size.y / 2) * group.userData.baseScale;
          resolve(group);
        }, undefined, reject);
      }));
    }
    return cache.get(id);
  }

  let active = null;
  let fading = [];
  let token = 0;
  let current = -1;

  function updatePlacard(p) {
    commonEl.textContent = p.common;
    latinEl.textContent = p.latin;
    specsEl.innerHTML =
      `<div><dt>Mature size</dt><dd>${p.size}</dd></div>` +
      `<div><dt>Exposure</dt><dd>${p.sun}</dd></div>` +
      `<div><dt>Water</dt><dd>${p.water}</dd></div>` +
      `<div><dt>Hardy to</dt><dd>${p.hardy}</dd></div>`;
  }

  async function swapModel(id) {
    const t = ++token;
    let group;
    try { group = await load(id); } catch { return; }
    if (t !== token) return;
    if (active) { active.group.userData.fadeTarget = 0; fading.push(active.group); }
    group.userData.fadeTarget = 1;
    if (!group.parent) holder.add(group);
    rotY = 0; rotVel = 0; // face front on every change
    active = { group };
  }

  function select(i) {
    if (i === current) return;
    current = (i + PLANTS.length) % PLANTS.length;
    const p = PLANTS[current];
    thumbs.forEach((b, k) => {
      const on = k === current;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    // keep the active thumb in view in the scrollable strip
    thumbs[current].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    updatePlacard(p);
    if (renderer) swapModel(p.id);
    kick();
  }

  prevBtn?.addEventListener('click', () => select(current - 1));
  nextBtn?.addEventListener('click', () => select(current + 1));
  // ←/→ when the section is in view
  let inView = false;
  document.addEventListener('keydown', (e) => {
    if (!inView) return;
    if (e.key === 'ArrowLeft') { select(current - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { select(current + 1); e.preventDefault(); }
  });

  // ── Drag to turn ──
  let rotY = 0, rotVel = 0, dragging = false, lastX = 0, idleAt = 0, dragged = false;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; el.setPointerCapture?.(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    rotVel = dx * 0.006; rotY += rotVel; idleAt = performance.now() + 2600;
    if (!dragged && Math.abs(dx) > 2) { dragged = true; hintEl?.classList.add('is-hidden'); }
  });
  const endDrag = () => (dragging = false);
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  // ── Sizing ──
  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(wrap);
  resize();

  // ── Render loop (visible-only, with hidden-tab fallback) ──
  let visible = true, raf = null, lastT = 0;
  const AUTO = reduceMotion ? 0 : 0.0019;

  function frame(t) {
    raf = null;
    const dt = Math.min(50, t - lastT || 16);
    lastT = t;

    if (!dragging) {
      rotVel *= 0.94;
      rotY += rotVel;
      if (t > idleAt) rotY += AUTO * (dt / 16.7);
    }
    holder.rotation.y = rotY;

    const FADE = dt / 460;
    let animating = false;
    holder.children.forEach((g) => {
      const target = g.userData.fadeTarget ?? 0;
      let v = g.userData.fade ?? 0;
      const nv = Math.max(0, Math.min(1, v + (target > v ? 1 : -1) * FADE));
      if (nv !== v) animating = true;
      g.userData.fade = nv;
      const e = 1 - Math.pow(1 - nv, 3);
      g.userData.mats.forEach((m) => (m.uniforms.uOpacity.value = e));
      const s = (0.92 + 0.08 * e) * (g.userData.baseScale || 1);
      g.scale.setScalar(s);
      g.position.y = (1 - e) * -0.05;
    });
    fading = fading.filter((g) => {
      if ((g.userData.fade ?? 0) <= 0.001) { holder.remove(g); return false; }
      return true;
    });

    if (active?.group.userData.footprint) {
      const want = Math.max(0.72, active.group.userData.footprint / 0.46);
      const cur = pedestal.scale.x;
      pedestal.scale.setScalar(cur + (want - cur) * Math.min(1, dt / 300));
      const wantY = active.group.userData.centerY + 0.04;
      camY += (wantY - camY) * Math.min(1, dt / 420);
      camera.position.y = camY + 0.16;
      camera.lookAt(0, camY, 0);
      if (Math.abs(wantY - camY) > 0.002) animating = true;
    }

    renderer.render(scene, camera);

    const spinning = Math.abs(rotVel) > 0.0002 || (t <= idleAt) || AUTO > 0;
    if (visible && (animating || spinning)) kick();
  }
  function kick() {
    if (raf || !visible) return;
    raf = document.hidden ? setTimeout(() => frame(performance.now()), 250) : requestAnimationFrame(frame);
  }

  new IntersectionObserver((entries) => {
    inView = visible = entries[0].isIntersecting;
    kick();
  }, { threshold: 0.1, rootMargin: '80px' }).observe(stage);
  document.addEventListener('visibilitychange', kick);

  // First specimen now; prefetch the rest when idle.
  select(0);
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  idle(() => PLANTS.slice(1).forEach((p) => load(p.id)));
}
