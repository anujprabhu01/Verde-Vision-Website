// Open the landing page at the top — don't let the browser restore a
// mid-page scroll on reload (it also pre-triggers on-scroll reveals).
// EXCEPT when the URL carries a real #section hash: shared links like
// /#booking must land on that section, not get stripped.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
{
  const deepLink = window.location.hash && document.getElementById(window.location.hash.slice(1));
  if (deepLink) {
    // Snap to the section once the loader's iris has opened (scrolling is
    // clamped while html.is-loading holds overflow:hidden), and again after
    // webfonts/3D models settle the layout beneath it.
    let tries = 0;
    const jump = () => {
      if (document.documentElement.classList.contains('is-loading')) {
        if (++tries < 100) setTimeout(jump, 80);
        return;
      }
      deepLink.scrollIntoView();
    };
    jump();
    window.addEventListener('load', () => setTimeout(() => deepLink.scrollIntoView(), 250), { once: true });
  } else {
    // The browser can (re)apply its remembered scroll position after this
    // script runs — once webfonts swap, or once the Plant Library's 3D
    // models load and settle the layout — so keep pinning to the top for a
    // few seconds, until the visitor scrolls on their own.
    let settled = false;
    const stop = () => { settled = true; };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type =>
      window.addEventListener(type, stop, { once: true, passive: true }));
    const start = performance.now();
    const poll = () => {
      if (settled) return;
      if (window.scrollY > 0) window.scrollTo(0, 0);
      if (performance.now() - start < 4000) requestAnimationFrame(poll);
    };
    poll();
  }
}

// ── Mobile nav toggle ──
(() => {
  const nav = document.querySelector('nav');
  const toggle = document.querySelector('.nav-toggle');
  if (!nav || !toggle) return;
  const links = nav.querySelectorAll('.nav-links a');
  const close = () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  };
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  links.forEach(link => link.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();

// ── Before/After slider ──
const baSlider = document.getElementById('ba-slider');
const baBefore = document.getElementById('ba-before');
const baHandle = document.getElementById('ba-handle');
const baBtnBefore = document.getElementById('ba-btn-before');
const baBtnAfter = document.getElementById('ba-btn-after');

if (baSlider) {
  let dragging = false;
  let autoplayRaf = null;
  let userInteracted = false;
  let autoplaying = true;

  function setPct(pct) {
    pct = Math.max(0, Math.min(100, pct));
    // Drive both the live slider and the mirrored reflection through one var
    // (handles position via `left: calc(var(--ba-pct) * 1%)` in CSS).
    document.documentElement.style.setProperty('--ba-pct', pct);
    if (!autoplaying) {
      document.querySelectorAll('.ba-label-before').forEach(el => el.classList.toggle('is-active', pct >= 99));
      document.querySelectorAll('.ba-label-after').forEach(el => el.classList.toggle('is-active', pct <= 1));
    }
  }

  function setPosition(clientX) {
    const rect = baSlider.getBoundingClientRect();
    setPct(((clientX - rect.left) / rect.width) * 100);
  }

  // Initial state: full BEFORE visible, handle on the right — animation starts here.
  setPct(100);

  // Pointer events + CSS touch-action:pan-y (styles.css) let vertical swipes
  // that start on the visor keep scrolling the page — the browser cancels
  // the pointer stream (pointercancel) when it claims the gesture, and only
  // horizontal drags reach onMove. No preventDefault needed.
  const onDown = (e) => {
    dragging = true;
    baSlider.classList.add('is-grabbing');
    cancelAutoplay();
    baSlider.setPointerCapture?.(e.pointerId);
    const rect = baSlider.getBoundingClientRect();
    const targetPct = ((e.clientX - rect.left) / rect.width) * 100;
    // Smoothly glide to where they pressed; if they actually drag, onMove cancels this.
    snapTo(targetPct);
  };
  const onMove = (e) => {
    if (!dragging) return;
    cancelSnap();
    setPosition(e.clientX);
  };
  const onUp = () => {
    dragging = false;
    baSlider.classList.remove('is-grabbing');
  };

  baSlider.addEventListener('pointerdown', onDown);
  baSlider.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  baSlider.addEventListener('pointercancel', onUp);

  // Smooth animated transition to a target percentage. Duration scales with distance
  // so short hops feel snappy and long sweeps feel deliberate.
  let snapRaf = null;
  function cancelSnap() {
    if (snapRaf) { cancelAnimationFrame(snapRaf); snapRaf = null; }
  }
  function snapTo(targetPct, duration) {
    cancelAutoplay();
    cancelSnap();
    const from = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ba-pct')) || 50;
    if (duration === undefined) {
      duration = Math.max(180, Math.min(500, Math.abs(targetPct - from) * 5));
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setPct(from + (targetPct - from) * easeInOutCubic(t));
      if (t < 1) snapRaf = requestAnimationFrame(step);
      else snapRaf = null;
    };
    snapRaf = requestAnimationFrame(step);
  }
  const stop = (e) => e.stopPropagation();
  [baBtnBefore, baBtnAfter].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener('pointerdown', stop);
  });
  baBtnBefore?.addEventListener('click', (e) => { stop(e); snapTo(100); });
  baBtnAfter?.addEventListener('click', (e) => { stop(e); snapTo(0); });

  // ── First-visit autoplay sweep: 100 → 0 → 50 ──
  function cancelAutoplay() {
    userInteracted = true;
    if (autoplayRaf) {
      cancelAnimationFrame(autoplayRaf);
      autoplayRaf = null;
    }
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animatePhase(from, to, duration, ease) {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now) => {
        if (userInteracted) return resolve();
        const t = Math.min(1, (now - start) / duration);
        setPct(from + (to - from) * ease(t));
        if (t < 1) {
          autoplayRaf = requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      autoplayRaf = requestAnimationFrame(step);
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function runAutoplay() {
    // Sweep left to reveal AFTER, brief hold, then settle to the middle.
    autoplaying = true;
    baBtnBefore?.classList.remove('is-active');
    baBtnAfter?.classList.remove('is-active');
    try {
      await animatePhase(100, 0, 1100, easeInOutCubic);
      if (userInteracted) return;
      await delay(200);
      if (userInteracted) return;
      await animatePhase(0, 50, 600, easeOutCubic);
    } finally {
      autoplaying = false;
      if (!userInteracted) setPct(50);
    }
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    autoplaying = false;
    setPct(50);
  } else {
    const autoplayObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !userInteracted) {
          obs.disconnect();
          // Small delay so the section is comfortably in view before the sweep.
          setTimeout(() => { if (!userInteracted) runAutoplay(); }, 250);
        }
      });
    }, { threshold: 0.4 });
    autoplayObserver.observe(baSlider);
  }

  // ── iOS layer-eviction guard ──
  // Scrolling the hero far off-screen lets iOS evict the visor's composited,
  // SVG-masked image layers; on return it sometimes fails to re-rasterize
  // them and paints the black lens backdrop instead. When the hero re-enters
  // the viewport, hold a nudged transform on the image layers for a couple of
  // painted frames, then release — forcing a fresh rasterization pass.
  const visorLayers = document.querySelectorAll('.ba-stage, .ba-img');
  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual && visorLayers.length) {
    let wasOffscreen = false;
    const repaintObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry.isIntersecting) { wasOffscreen = true; return; }
      if (!wasOffscreen) return; // initial load — nothing evicted yet
      wasOffscreen = false;
      visorLayers.forEach((el) => { el.style.transform = 'translateZ(0) scale(1.002)'; });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        visorLayers.forEach((el) => { el.style.transform = ''; });
      }));
    });
    repaintObserver.observe(heroVisual);
  }
}


// ── Scroll progress indicator ──
const progressEl = document.querySelector('.scroll-progress');
if (progressEl) {
  let ticking = false;
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progressEl.style.setProperty('--scroll-progress', pct.toFixed(4));
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateProgress);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();
}


// ── Scroll-triggered reveals ──
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealTargets = document.querySelectorAll('[data-reveal-section]');

if (reduceMotion) {
  revealTargets.forEach((el) => el.classList.add('is-revealed'));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );
  revealTargets.forEach((el) => revealObserver.observe(el));
}


// Feature rows reveal via CSS scroll-driven animations (animation-timeline:
// view()) so they rise in tandem with the palm fronds as the section scrolls
// through — see styles.css. No IntersectionObserver needed.


// ── Demo video: mute / restart / timecode / scrubber ──
const muteBtn = document.getElementById('demo-video-mute');
const demoVideo = document.getElementById('demo-video');
const restartBtn = document.getElementById('demo-video-restart');
const actionRuntime = document.getElementById('action-runtime');
const actionDuration = document.getElementById('action-duration');
const actionProgress = document.getElementById('action-progress');
const actionProgressBar = document.getElementById('action-progress-bar');
const actionProgressKnob = document.getElementById('action-progress-knob');

const pad2 = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const fmtMMSS = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  return `${pad2(s / 60)}:${pad2(s % 60)}`;
};

if (muteBtn && demoVideo) {
  muteBtn.addEventListener('click', () => {
    demoVideo.muted = !demoVideo.muted;
    muteBtn.classList.toggle('is-unmuted', !demoVideo.muted);
    muteBtn.setAttribute('aria-label', demoVideo.muted ? 'Unmute video' : 'Mute video');
  });
}

if (restartBtn && demoVideo) {
  restartBtn.addEventListener('click', () => {
    demoVideo.currentTime = 0;
    const p = demoVideo.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  });
}

if (demoVideo) {
  // The video has no autoplay and preload="none" — nothing downloads until
  // the section scrolls into view. Play while visible, pause when it leaves
  // so it isn't looping (and decoding) off-screen for the whole session.
  // Entries can arrive batched (oldest first) — only the newest one is the
  // current state.
  let videoInView = false;
  const videoObserver = new IntersectionObserver((entries) => {
    videoInView = entries[entries.length - 1].isIntersecting;
    if (videoInView) {
      const p = demoVideo.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      demoVideo.pause();
    }
  }, { threshold: 0.25 });
  videoObserver.observe(demoVideo);
  // A play() issued while the file is still fetching can start playback
  // after a later pause() (queued-play race) — re-pause if that happens
  // while the section is off-screen.
  demoVideo.addEventListener('playing', () => {
    if (!videoInView) demoVideo.pause();
  });

  const updateDuration = () => {
    if (actionDuration && isFinite(demoVideo.duration)) {
      actionDuration.textContent = fmtMMSS(demoVideo.duration);
    }
  };
  demoVideo.addEventListener('loadedmetadata', updateDuration);
  demoVideo.addEventListener('durationchange', updateDuration);

  demoVideo.addEventListener('timeupdate', () => {
    const t = demoVideo.currentTime;
    const d = demoVideo.duration || 0;
    const pct = d ? (t / d) * 100 : 0;
    if (actionRuntime) actionRuntime.textContent = fmtMMSS(t);
    if (actionProgressBar) actionProgressBar.style.width = pct + '%';
    if (actionProgressKnob) actionProgressKnob.style.left = pct + '%';
    if (actionProgress) actionProgress.setAttribute('aria-valuenow', String(Math.round(pct)));
  });
}

if (actionProgress && demoVideo) {
  let dragging = false;
  const seek = (clientX) => {
    const rect = actionProgress.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (isFinite(demoVideo.duration) && demoVideo.duration > 0) {
      demoVideo.currentTime = pct * demoVideo.duration;
    }
  };
  actionProgress.addEventListener('pointerdown', (e) => {
    dragging = true;
    actionProgress.setPointerCapture?.(e.pointerId);
    seek(e.clientX);
  });
  actionProgress.addEventListener('pointermove', (e) => {
    if (dragging) seek(e.clientX);
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try { actionProgress.releasePointerCapture?.(e.pointerId); } catch (_) {}
  };
  actionProgress.addEventListener('pointerup', endDrag);
  actionProgress.addEventListener('pointercancel', endDrag);

  actionProgress.addEventListener('keydown', (e) => {
    const d = demoVideo.duration || 0;
    if (!d) return;
    if (e.key === 'ArrowLeft')  { demoVideo.currentTime = Math.max(0, demoVideo.currentTime - 5); e.preventDefault(); }
    if (e.key === 'ArrowRight') { demoVideo.currentTime = Math.min(d, demoVideo.currentTime + 5); e.preventDefault(); }
  });
}


// ── Active nav link on scroll ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('nav a.nav-link');

const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinks.forEach((link) => {
          link.classList.toggle(
            'active',
            link.getAttribute('href') === `#${entry.target.id}`
          );
        });
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);
sections.forEach((s) => navObserver.observe(s));


// ── ANNOUNCEMENT BANNER — a pop-down, not a fixture ──
// Drops in a few seconds after the page settles, stays long enough to read
// the line twice, then retires on its own. Once per SESSION rather than per
// page view: a strip that animates in on every single load is more
// irritating than one that just sits there. --banner-h carries the nav and
// the progress bar down with it, so nothing in the page itself reflows.
(function siteBanner() {
  const el = document.getElementById('site-banner');
  if (!el) return;
  const root = document.documentElement;
  const KEY = 'vv-banner-seen';
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) { /* private mode */ }

  const AFTER = 3000;    // measured from the moment the loader clears
  const STAY = 10000;

  const retire = () => root.classList.remove('banner-open');
  const show = () => {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ }
    root.classList.add('banner-open');
    setTimeout(retire, STAY);
  };
  document.getElementById('banner-close')?.addEventListener('click', retire);

  // start counting once the loader is out of the way, so the banner can't
  // spend its appearance behind the intro cover
  const start = () => setTimeout(show, AFTER);
  if (root.classList.contains('is-loading')) {
    const mo = new MutationObserver(() => {
      if (root.classList.contains('is-loading')) return;
      mo.disconnect(); start();
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  } else {
    start();
  }
})();

// ── Pricing — billing toggle, card detail expanders, founding-pricing form ──
const btMonthly      = document.getElementById('bt-monthly');
const btAnnual       = document.getElementById('bt-annual');
const applyForm      = document.getElementById('apply-form');
const applyWrap      = document.getElementById('apply');
const confirmBtn     = document.getElementById('confirm-btn');
const applyConf      = document.getElementById('apply-confirmation');
const confirmDetails = document.getElementById('confirm-details');

let billing = 'monthly';

function setBilling(period) {
  billing = period;
  document.querySelectorAll('[data-monthly]').forEach((el) => {
    el.textContent = el.dataset[period];
  });
  btMonthly?.classList.toggle('selected', period === 'monthly');
  btAnnual?.classList.toggle('selected', period === 'annual');
  btMonthly?.setAttribute('aria-pressed', String(period === 'monthly'));
  btAnnual?.setAttribute('aria-pressed', String(period === 'annual'));
}

btMonthly?.addEventListener('click', () => setBilling('monthly'));
btAnnual?.addEventListener('click', () => setBilling('annual'));

// "Full plan details" — expands the card in place.
document.querySelectorAll('.price-details-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const open = panel.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
});

// The founding card's CTA hands off to the form below.
document.querySelectorAll('.price-cta').forEach((btn) => {
  btn.addEventListener('click', () => {
    applyWrap?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Focus after the smooth scroll settles; preventScroll so focus doesn't yank the page.
    setTimeout(() => document.getElementById('form-name')?.focus({ preventScroll: true }), 500);
  });
});

// ── Replace this URL with your Formspree endpoint ──
// 1. Sign up free at formspree.io
// 2. Create a new form → set email to demos@useverdevision.com
// 3. Paste your endpoint here (e.g. https://formspree.io/f/xxxxxxxx)
const FORMSPREE_URL = 'https://formspree.io/f/xnjlkzde';

applyForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name      = document.getElementById('form-name').value.trim();
  const company   = document.getElementById('form-company').value.trim();
  const email     = document.getElementById('form-email').value.trim();
  const designers = document.getElementById('form-designers').value;
  const headset   = document.getElementById('form-headset').value;
  const note      = document.getElementById('form-note').value.trim();

  const submitLabel = confirmBtn.textContent;
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Sending…';

  try {
    const res = await fetch(FORMSPREE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        plan: 'Founding Partner',
        billing,
        name,
        company,
        email,
        designers,
        vision_pro: headset,
        note: note || '-',
        _subject: `Founding pricing request from ${name} - ${company}`,
      }),
    });

    if (!res.ok) throw new Error('submission failed');

    confirmDetails.textContent = `${name}, your founding pricing request for ${company} is in.`;
    applyWrap.style.display = 'none';
    applyConf.classList.add('visible');
    applyConf.focus();
  } catch {
    confirmBtn.disabled = false;
    confirmBtn.textContent = submitLabel;
    alert('Something went wrong - please try again or email us at demos@useverdevision.com');
  }
});

// ── WHY IT WINS — an interactive topographic field ──
// A dense contour map (value-noise + marching squares) fills the section.
// The cursor raises a soft dome under the pointer; each bubble raises a much
// larger one as it grows on hover/focus, so the contours visibly bulge
// outward around an expanding bubble. The render loop only runs while
// something is moving — the cursor lerping toward its target, or a bubble
// mid CSS-transition (sampled live via getBoundingClientRect, so JS never
// has to duplicate the easing curve).
(function whyTopo() {
  const why = document.getElementById('why');
  const canvas = document.getElementById('why-topo');
  if (!why || !canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // deterministic value-noise, smoothed with a fade curve
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + 17) * 43758.5453;
    return s - Math.floor(s);
  };
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);
    return lerp(
      lerp(hash(xi, yi), hash(xi + 1, yi), u),
      lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u),
      v
    );
  }
  // three octaves of noise → a varied but smooth elevation field
  function elevation(x, y) {
    return noise(x * 0.0035, y * 0.0035) * 1.0
         + noise(x * 0.009 + 90, y * 0.009 + 90) * 0.5
         + noise(x * 0.022 + 180, y * 0.022 + 180) * 0.25;
  }

  let w = 0, h = 0, cell = 16, cols = 0, rows = 0, field = null;
  const bubbles = Array.from(why.querySelectorAll('.why-bubble')).map((el) => ({
    el, cx: 0, cy: 0, r: 0, base: el.getBoundingClientRect().width / 2, growth: 0
  }));
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, on: 0, target: 0 };

  function measure() {
    const r = why.getBoundingClientRect();
    bubbles.forEach((b) => {
      const br = b.el.getBoundingClientRect();
      b.cx = br.left + br.width / 2 - r.left;
      b.cy = br.top + br.height / 2 - r.top;
      b.r = br.width / 2;
      b.growth = Math.max(0, b.r - b.base);
    });
  }

  function resize() {
    const r = why.getBoundingClientRect();
    w = r.width; h = r.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = w < 720 ? 22 : 16;
    cols = Math.ceil(w / cell) + 1;
    rows = Math.ceil(h / cell) + 1;
    field = new Float32Array(cols * rows);
    mouse.x = mouse.tx = w / 2;
    mouse.y = mouse.ty = h / 2;
    bubbles.forEach((b) => { b.base = b.el.getBoundingClientRect().width / 2; });
    measure();
    computeField();
    draw();
  }

  // ── elevation field: base terrain + a dome under the cursor + a much
  //    larger dome under any bubble currently mid-expansion ──
  function computeField() {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * cell, y = j * cell;
        let e = elevation(x, y);
        if (mouse.on > 0.01) {
          const dx = x - mouse.x, dy = y - mouse.y;
          e += mouse.on * 0.8 * Math.exp(-(dx * dx + dy * dy) / (2 * 120 * 120));
        }
        for (const b of bubbles) {
          if (b.growth < 1) continue;
          const dx = x - b.cx, dy = y - b.cy;
          const radius = b.r * 1.1;
          e += b.growth * 0.013 * Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius));
        }
        field[j * cols + i] = e;
      }
    }
  }

  // marching-squares: for each 4-bit corner case, which edges (T,R,B,L = 0..3)
  // the contour crosses (saddle cases 5/10 draw both diagonals)
  const EDGES = [
    null, [3, 2], [2, 1], [3, 1], [0, 1], [3, 0, 2, 1], [0, 2], [3, 0],
    [3, 0], [0, 2], [3, 0, 2, 1], [0, 1], [3, 1], [2, 1], [3, 2], null
  ];
  const LEVELS = (() => {
    const out = [];
    for (let v = -1.9; v <= 2.6; v += 0.16) out.push(v);
    return out;
  })();

  function draw() {
    ctx.clearRect(0, 0, w, h);
    // ink darkens toward the cursor — a radial gradient centred on it,
    // fading out to the base opacity; mouse.on scales it to 0 when idle
    const glowRadius = 220;
    const glow = 0.4 * mouse.on;
    const majorGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, glowRadius);
    majorGrad.addColorStop(0, `rgba(46,93,67,${(0.32 + glow).toFixed(3)})`);
    majorGrad.addColorStop(1, 'rgba(46,93,67,0.32)');
    const minorGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, glowRadius);
    minorGrad.addColorStop(0, `rgba(46,93,67,${(0.18 + glow * 0.7).toFixed(3)})`);
    minorGrad.addColorStop(1, 'rgba(46,93,67,0.18)');
    LEVELS.forEach((level, li) => {
      const path = new Path2D();
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const tl = field[j * cols + i], tr = field[j * cols + i + 1];
          const bl = field[(j + 1) * cols + i], br = field[(j + 1) * cols + i + 1];
          let c = 0;
          if (tl > level) c |= 8;
          if (tr > level) c |= 4;
          if (br > level) c |= 2;
          if (bl > level) c |= 1;
          const edges = EDGES[c];
          if (!edges) continue;
          const x = i * cell, y = j * cell;
          const pt = (edge) => {
            switch (edge) {
              case 0: return [x + cell * (level - tl) / (tr - tl), y];
              case 1: return [x + cell, y + cell * (level - tr) / (br - tr)];
              case 2: return [x + cell * (level - bl) / (br - bl), y + cell];
              default: return [x, y + cell * (level - tl) / (bl - tl)];
            }
          };
          for (let k = 0; k < edges.length; k += 2) {
            const a = pt(edges[k]), bp = pt(edges[k + 1]);
            path.moveTo(a[0], a[1]);
            path.lineTo(bp[0], bp[1]);
          }
        }
      }
      ctx.lineWidth = li % 5 === 0 ? 1.1 : 0.7;
      ctx.strokeStyle = li % 5 === 0 ? majorGrad : minorGrad;
      ctx.stroke(path);
    });
  }

  let raf = null;
  function loop() {
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    mouse.on += (mouse.target - mouse.on) * 0.08;
    measure();
    let moving = Math.abs(mouse.tx - mouse.x) > 0.2 || Math.abs(mouse.ty - mouse.y) > 0.2
      || Math.abs(mouse.target - mouse.on) > 0.003;
    bubbles.forEach((b) => { if (b.growth > 0.5) moving = true; });
    computeField();
    draw();
    raf = moving ? requestAnimationFrame(loop) : null;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(loop); }

  resize();

  // styles.css loads non-render-blocking (media=print → all onload), so the
  // first resize() above can run before .why receives its full height — the
  // section is still collapsed and the canvas gets sized to a thin top band
  // that then never fills. Re-measure whenever the section's box actually
  // changes (CSS applying late, web-font swap, any reflow) and once fonts
  // settle, so the contour field always covers the whole section. (footerTopo
  // already re-measures on fonts.ready; whyTopo was the one missing it.)
  let resizeRaf = null;
  const scheduleResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => { resizeRaf = null; resize(); });
  };
  addEventListener('resize', scheduleResize);
  if (window.ResizeObserver) new ResizeObserver(scheduleResize).observe(why);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

  if (reduce) return;

  why.addEventListener('pointermove', (e) => {
    const r = why.getBoundingClientRect();
    mouse.tx = e.clientX - r.left;
    mouse.ty = e.clientY - r.top;
    mouse.target = 1;
    wake();
  });
  why.addEventListener('pointerleave', () => { mouse.target = 0; wake(); });

  bubbles.forEach((b) => {
    ['pointerenter', 'pointerleave', 'focus', 'blur'].forEach((ev) => b.el.addEventListener(ev, wake));
    b.el.addEventListener('click', () => {
      const willActivate = !b.el.classList.contains('is-active');
      bubbles.forEach((o) => o.el.classList.remove('is-active'));
      if (willActivate) b.el.classList.add('is-active');
      wake();
    });
  });

  why.addEventListener('click', (e) => {
    if (!e.target.closest('.why-bubble')) {
      bubbles.forEach((b) => b.el.classList.remove('is-active'));
      wake();
    }
  });

})();

// ── CATALOG SHELVES ON TOUCH — hold to stop them ──
// The shelves pause on hover, which a finger doesn't have. Before this the
// only way to stop one on a phone was to open a plant card. A touch anywhere
// on the shelves holds all three still, and they start again a beat after
// you let go, so a tap that opens a card doesn't leave them frozen.
(function shelfHold() {
  const rows = document.querySelector('.catalog-rows');
  if (!rows) return;
  let release = 0;
  const hold = () => { clearTimeout(release); rows.classList.add('is-held'); };
  const letGo = () => {
    clearTimeout(release);
    release = setTimeout(() => rows.classList.remove('is-held'), 2500);
  };
  rows.addEventListener('touchstart', hold, { passive: true });
  rows.addEventListener('touchend', letGo, { passive: true });
  rows.addEventListener('touchcancel', letGo, { passive: true });
})();

// ── MARQUEES — the credibility ticker and the three catalog shelves ──
// Each [data-marquee] holds one [data-marquee-track]. The CSS translates the
// track by -50%; that's only seamless if it holds two identical halves, so the
// authored items are cloned once here (markup stays single-source; no JS → the
// single set just sits static). A data-speed (px/s) sets the animation
// duration from the track's own width so every shelf moves at the same pace
// regardless of how many tiles it carries. Off-screen shelves are paused so
// they don't churn the compositor while you read the rest of the page.
(function marquees() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('[data-marquee]').forEach((row) => {
    const track = row.querySelector('[data-marquee-track]');
    if (!track) return;
    Array.from(track.children).forEach((node) => {
      const clone = node.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('button, a').forEach((el) => { el.tabIndex = -1; });   // one tab stop per tile
      track.appendChild(clone);
    });
    const speed = Number(row.dataset.speed);
    if (speed > 0) {
      const setDuration = () => {
        const half = track.scrollWidth / 2;
        if (half > 0) track.style.setProperty('--dur', `${(half / speed).toFixed(1)}s`);
      };
      // styles.css loads non-blocking, so the first measurement can land on
      // the unstyled track — re-measure once the sheet applies, on load, on
      // fonts, and whenever the track's box changes (see canvas notes above).
      setDuration();
      document.getElementById('app-css')?.addEventListener('load', setDuration, { once: true });
      window.addEventListener('load', setDuration, { once: true });
      if (window.ResizeObserver) new ResizeObserver(setDuration).observe(track);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(setDuration);
    }
    // A class, not an inline style: inline animation-play-state outranks every
    // stylesheet rule, so setting 'running' here silently killed the hover
    // pause on both the shelves and the credibility ticker (the !important on
    // the card-open rule is the scar from that). Every pause reason now sets
    // the same value through CSS, so they simply add up.
    const io = new IntersectionObserver((entries) => {
      row.classList.toggle('is-offscreen', !entries[0].isIntersecting);
    });
    io.observe(row);
  });
})();

// ── TYPESET HEADLINES — section h2s rise line by line out of clipped boxes
// Line breaks depend on the viewport and the fonts, so the split happens
// here, after the stylesheet and the webfonts are in: wrap every word, read
// which rendered line it landed on, then rebuild the heading as one clipped
// block per line (re-wrapping the <em> runs). styles.css animates .hl-in.
// Re-split on resize; a heading whose section is already revealed simply
// re-renders in place. Off under reduced motion — the plain fade stays.
(function typesetHeadlines() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const heads = Array.from(document.querySelectorAll('[data-reveal-section] h2.reveal'));
  if (!heads.length) return;
  heads.forEach((h) => { h.dataset.hlHtml = h.innerHTML; h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim()); });

  // Every word is wrapped so its rendered line can be read off the layout.
  // `space` records whether real whitespace preceded it — punctuation that
  // follows a tag ("<em>yard</em>.") has none, and must not gain one when
  // the line is rebuilt.
  let spaced = false;
  const wrapWords = (node, words, em) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); spaced = true; return; }
          const w = document.createElement('span'); w.textContent = part;
          frag.appendChild(w); words.push({ w, em, space: spaced });
          spaced = false;
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') {
        wrapWords(child, words, em || child.tagName === 'EM');
      }
    });
  };
  const split = (h) => {
    h.innerHTML = h.dataset.hlHtml;
    const words = []; spaced = false; wrapWords(h, words, false);
    const lines = []; let top = null;
    words.forEach((word) => {
      const t = word.w.offsetTop;
      if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
      lines[lines.length - 1].push(word);
    });
    const base = getComputedStyle(h).transitionDelay;      // the h2's own stagger slot (.reveal-2 etc.)
    h.textContent = '';
    lines.forEach((line, i) => {
      const box = document.createElement('span'); box.className = 'hl-line';
      const inner = document.createElement('span'); inner.className = 'hl-in';
      inner.style.setProperty('--i', i);
      let em = null;
      line.forEach((word, j) => {
        const target = word.em ? (em || (em = inner.appendChild(document.createElement('em')))) : (em = null, inner);
        if (j && word.space) target.appendChild(document.createTextNode(' '));
        target.appendChild(document.createTextNode(word.w.textContent));
      });
      if (i < lines.length - 1) inner.appendChild(document.createTextNode(' '));   // so a copied headline keeps its spaces
      box.appendChild(inner); h.appendChild(box);
    });
    h.style.setProperty('--hl-base', base);
    h.classList.add('is-split');
  };
  let width = -1, t = 0;
  const run = () => {
    if (!innerWidth || innerWidth === width) return;    // nothing to measure in a 0-wide (hidden) tab
    width = innerWidth;
    heads.forEach(split);
  };
  const ready = Promise.all([
    document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
    new Promise((res) => {
      const link = document.getElementById('app-css');
      if (!link || link.media === 'all' || link.sheet) res(); else link.addEventListener('load', res, { once: true });
    }),
  ]);
  ready.then(() => {
    run();
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(run, 150); });
  });
})();

// ── PLANT CARDS — click any catalog tile for its card ────────────────
// The card's facts come from assets/catalog/catalog.json, which
// tools/export_catalog.py writes from the app's own PlantItem catalog, so the
// site can only say what the app says. Fetched once — warmed as the shelves
// approach, or on the first click — and shown in a native <dialog> (focus
// trap, Esc, focus return all come free). The shelves pause while it's open.
(function plantCards() {
  const dialog = document.getElementById('plant-card');
  const rows = document.querySelector('.catalog-rows');
  if (!dialog || !rows || typeof dialog.showModal !== 'function') return;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let data = null, loading = null;
  const load = () => loading || (loading = fetch('assets/catalog/catalog.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d) => (data = d))
    .catch((err) => { loading = null; throw err; }));

  const fill = (p) => {
    const isPlant = p.category !== 'hardscape' && p.category !== 'lighting';
    dialog.classList.toggle('is-photo', !!p.photo);
    const img = $('pc-img'); const c = p.card || { src: p.image, w: 320, h: 320 };
    img.width = c.w; img.height = c.h; img.src = c.src; img.alt = p.name;
    $('pc-kind').textContent = p.kind;
    const made = $('pc-made');
    made.textContent = p.made === 'scanned' ? (isPlant ? 'Scanned from a real plant' : 'Scanned on site')
                     : p.made === 'modelled' ? 'Modelled in 3D' : '';
    made.dataset.made = p.made || '';
    made.hidden = !p.made;
    $('pc-name').textContent = p.name;
    const bot = $('pc-botanical'); bot.textContent = p.botanical || ''; bot.hidden = !p.botanical;
    const size = p.category === 'lighting' ? p.height
               : p.height && p.width ? `${p.height} tall × ${p.width} wide` : p.height || p.width;
    const facts = [
      [isPlant ? 'Mature size' : p.category === 'lighting' ? 'Height' : 'Size', size],
      ['Sun', p.sun], ['Water', p.water],
      ['Cold hardy to', p.coldF == null ? null : `${p.coldF} °F`],
      ['Blooms', p.bloom], ['Growth', p.growth], ['Lifespan', p.lifespan],
      ['Origin', p.origin, true],
    ].filter(([, v]) => v);
    $('pc-facts').innerHTML = facts.map(([k, v, wide]) =>
      `<div${wide ? ' class="wide"' : ''}><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    const sizes = $('pc-sizes');
    sizes.innerHTML = p.sizes && p.sizes.length
      ? `<b>${isPlant ? 'Sizes in the app' : 'Sizes'}</b> &middot; ${p.sizes.map(esc).join(' &middot; ')}` : '';
    sizes.hidden = !sizes.innerHTML;
    $('pc-desc').textContent = p.description || '';
  };

  const open = (slug) => load().then(() => {
    const p = data && data[slug];
    if (!p) return;
    fill(p);
    dialog.showModal();
    $('pc-body').scrollTop = 0;
  }).catch(() => {});
  // the page state follows the dialog's own `open` attribute, whichever way it
  // closes (Esc, backdrop, the button) — the close event is a queued task and
  // a backgrounded tab can hold it back
  const sync = () => document.documentElement.classList.toggle('card-open', dialog.open);
  new MutationObserver(sync).observe(dialog, { attributes: true, attributeFilter: ['open'] });

  rows.addEventListener('click', (e) => {
    const tile = e.target.closest('.cat-tile[data-plant]');
    if (tile) open(tile.dataset.plant);
  });
  // hovering a tile fetches its card image, so the click opens on a picture
  const warmed = new Set();
  rows.addEventListener('mouseover', (e) => {
    const tile = e.target.closest('.cat-tile[data-plant]');
    const p = tile && data && data[tile.dataset.plant];
    if (!p || !p.card || warmed.has(p.slug)) return;
    warmed.add(p.slug); new Image().src = p.card.src;
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });   // the backdrop
  dialog.querySelector('.pc-close').addEventListener('click', () => dialog.close());

  if (window.IntersectionObserver) {
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect(); load().catch(() => {});
    }, { rootMargin: '600px 0px' });
    io.observe(rows);
  }
})();

// FEATURES — the palm fronds (grow) and the feature text (rise) are now driven
// entirely by CSS scroll-driven animations (animation-timeline: view()), so they
// animate continuously with scroll position regardless of where the page loads.
// No JS observer needed; see styles.css.

// ── NIGHT — Day / Night: one crossfade between the daylight frame and the
// lit one, and night falling on the section with it (.is-night on the
// section drives the ink, the type and the controls in CSS). Plays once by
// itself as the section enters — after both frames have decoded so the fade
// never pops — then the buttons own it.
(function nightMode() {
  const scene = document.getElementById('night-scene');
  if (!scene) return;
  const section = scene.closest('.night');
  const figure = scene.closest('.night-figure');
  const frames = Array.from(scene.querySelectorAll('.night-frame'));
  const buttons = Array.from(document.querySelectorAll('.night-btn'));

  let timer = 0;
  const setButtons = (state) => buttons.forEach((b) => {
    const on = b.dataset.state === state;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const goDay = () => {
    clearTimeout(timer);
    scene.dataset.state = 'day';
    figure?.classList.remove('is-night');
    section?.classList.remove('is-night');
    setButtons('day');
  };
  const goNight = () => {
    clearTimeout(timer);
    setButtons('night');
    figure?.classList.add('is-night');
    section?.classList.add('is-night');
    scene.dataset.state = 'night';
  };
  buttons.forEach((b) => b.addEventListener('click', () => (b.dataset.state === 'night' ? goNight() : goDay())));

  let ready = null;
  const warm = () => {
    if (ready) return ready;
    frames.forEach((img) => { img.loading = 'eager'; });
    ready = Promise.all(frames.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
    return ready;
  };
  new IntersectionObserver((entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect(); warm();
  }, { rootMargin: '900px 0px' }).observe(scene);

  // Fire as the section's top edge comes into view, so the darkness is
  // already gathering while the window scrolls up into place.
  let played = false;
  new IntersectionObserver((entries, io) => {
    if (played || !entries.some((e) => e.isIntersecting)) return;
    played = true; io.disconnect();
    warm().then(() => { timer = setTimeout(goNight, 60); });
  }, { threshold: 0.02 }).observe(section || scene);

  // ── stars: two static layers drawn once per size — a dense, faint, far
  // field and a sparse, bright, near one (CSS slips them past each other on
  // scroll). Densest in the sky above the headline, thinning toward the foot.
  // A handful of DOM "breathers" ease in and out on their own.
  const far = document.getElementById('night-stars-far');
  const near = document.getElementById('night-stars-near');
  const breathers = document.getElementById('night-breathers');
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const drawLayer = (canvas, seed, per, sizeMin, sizeMax, aMin, halo) => {
    const r = canvas.getBoundingClientRect();
    const w = Math.round(r.width), hgt = Math.round(r.height);
    if (!w || !hgt) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = hgt * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const count = Math.round((w * hgt) / per);
    for (let i = 0; i < count; i++) {
      const k = seed + i * 3;
      const x = hash(k + 1) * w;
      const yy = hash(k + 2);
      if (hash(k + 3) > Math.pow(Math.max(0, 1 - yy / 0.93), 1.1)) continue;
      const y = yy * hgt;
      const size = sizeMin + hash(k * 7 + 5) * (sizeMax - sizeMin);
      ctx.globalAlpha = aMin + Math.pow(hash(k * 11 + 9), 1.3) * (1 - aMin);
      ctx.fillStyle = hash(k * 13 + 4) < 0.22 ? '#d6e4ff' : '#fff6e6';
      if (halo) { ctx.shadowColor = 'rgba(255,246,225,0.8)'; ctx.shadowBlur = 5 + size * 2; } else { ctx.shadowBlur = 0; }
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  };
  const draw = () => {
    if (far) drawLayer(far, 1000, 2400, 0.45, 1.1, 0.3, false);
    if (near) drawLayer(near, 5000, 11000, 1.1, 2.1, 0.6, true);
    if (breathers && !breathers.childElementCount) {
      for (let i = 0; i < 12; i++) {
        const b = document.createElement('span');
        b.className = 'night-breather';
        b.style.left = (8 + hash(i * 5 + 21) * 84) + '%';
        b.style.top = (6 + hash(i * 5 + 22) * 54) + '%';
        b.style.setProperty('--dur', (5 + hash(i * 5 + 23) * 4).toFixed(1) + 's');
        b.style.setProperty('--delay', (-hash(i * 5 + 24) * 6).toFixed(1) + 's');
        breathers.appendChild(b);
      }
    }
  };
  if (far || near) {
    draw();
    if (window.ResizeObserver && section) new ResizeObserver(draw).observe(section);
    window.addEventListener('load', draw, { once: true });
  }
})();

// ── METEORS — a rare streak across the night sky, on its own schedule.
// Deliberately NOT tied to the cursor: the contour field in "why it wins"
// owns that gesture, and a trail that follows your hand is a comet, not a
// meteor. One at a time, only while the section is on screen, and only in
// Night (in Day the whole ink layer sits at opacity 0, so nothing shows and
// nothing needs to know). Between streaks there is no loop at all — a timer
// wakes the next one — and each flight clears only its own dirty rect
// rather than the whole sky.
(function meteors() {
  const canvas = document.getElementById('night-meteors');
  const section = document.getElementById('night');
  if (!canvas || !section) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');

  let w = 0, h = 0, dpr = 1;
  const size = () => {
    const r = canvas.getBoundingClientRect();
    w = Math.round(r.width); h = Math.round(r.height);
    if (!w || !h) return false;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  };

  // ── THE GREEN ONE. Real meteors do carry colour, but only the bright ones:
  // under about magnitude -4 you are seeing with rods, and rods are colour
  // blind, which is why an ordinary streak reads white. When one IS bright
  // enough to show a colour it is usually green, arrived at from two
  // directions at once - forbidden atomic oxygen at ~100 km (557.7 nm, the
  // same line that makes the aurora green) and nickel burning off the body.
  // So this is not a hue swap on the same sprite. The green one is brighter,
  // slower and longer, and it leaves a persistent train: the ghost of the
  // path, hanging for a beat after the head has gone. Anything less and it
  // reads as "there's a green one" instead of "wait - did I just see that".
  const DEBUG = /[?&]meteors=debug\b/.test(location.search);

  // Two fireballs, and they are the same machine burning different stuff.
  //
  // GREEN is the common one — forbidden atomic oxygen at ~100 km (557.7 nm,
  // the line that makes the aurora green) plus nickel off the body itself.
  // That oxygen line is also why it CHANGES COLOUR on the way down: the
  // excited state takes about 0.74s to radiate, which is an age at these
  // densities, so lower down collisions knock the atom out of it before it
  // can. The green is quenched and iron and sodium take over. Green high,
  // gold low, and never the other way round.
  //
  // VIOLET is ionised calcium, which needs far more excitation to light up at
  // all — the rarest colour a meteor actually shows. It stays cool as it
  // goes: calcium handing over to magnesium's blue-white rather than to the
  // warm metals.
  const GREEN  = { hi: [126, 232, 176], lo: [255, 204, 116], odds: DEBUG ? 3 : 20 };
  const VIOLET = { hi: [170, 128, 255], lo: [168, 202, 255], odds: DEBUG ? 6 : 100 };

  // And the rarest thing in the sky, which is not a meteor at all. A
  // supernova does not cross anything: it is a star that was not there,
  // arriving in place. SN 1006 reached about magnitude -7.5 — brighter than
  // Venus, roughly a quarter moon's worth of light, visible in daylight for
  // weeks and casting faint shadows at night. It "appeared suddenly, shone
  // with extraordinary intensity for months, and then slowly faded away":
  // fast up, slow down, nothing like the linear fade of a streak. Japanese
  // observers called it blue-white; Ibn Ridwan wrote down that the colour
  // changed as it went. Naked-eye galactic supernovae come a few times a
  // millennium, so it is the one thing here that earns being rarer than
  // everything else put together.
  const NOVA = { hi: [216, 232, 255], lo: [255, 192, 128], odds: DEBUG ? 8 : 200, nova: true };
  const NOVA_RISE = 380;        // the flash: sudden, but not a single frame
  const NOVA_FLASH_TAU = 820;   // and it does not last — the core goes first
  const NOVA_SHELL_IN = 140;    // the shell comes out of the flash, just behind it
  const NOVA_SHELL_RUN = 2700;  // how long it takes to reach full size
  const NOVA_TAU = 1900;        // the shell's own, slower decline
  const NOVA_R = 78;            // radius of the shell at full expansion
  const NOVA_LIFE = 6000;
  const NOVA_OUT = 800;         // final ramp to nothing, so it cannot snap off

  // Where along the path the handover happens. Flat at first, because up
  // there nothing is quenching anything, then given away through the second
  // half as the air thickens. Smoothstepped so there is no frame you can
  // point at and call the moment it changed.
  const SHIFT_IN = 0.30, SHIFT_OUT = 0.88;
  const rgb = (pal, s) => {
    let t = (s - SHIFT_IN) / (SHIFT_OUT - SHIFT_IN);
    t = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    return `${pal.hi[0] + (pal.lo[0] - pal.hi[0]) * t | 0},`
         + `${pal.hi[1] + (pal.lo[1] - pal.hi[1]) * t | 0},`
         + `${pal.hi[2] + (pal.lo[2] - pal.hi[2]) * t | 0}`;
  };
  // A persistent train outlives the meteor — that is the whole meaning of the
  // word. It does not end when the head does; it hangs where the head went
  // and goes out slowly. So the flight stays alive well past the head, the
  // decay is slow enough that the train is still clearly there when the head
  // dies, and TRAIN_OUT ramps whatever is left to nothing over the last half
  // second. That ramp is not tuning: it is what makes a hard cut impossible
  // no matter what the other two numbers are set to.
  const TRAIN_MS = 2400;      // how long past the head the flight stays alive for
  const TRAIN_TAU = 720;      // decay constant of a point from the moment it is passed
  const TRAIN_OUT = 520;      // final ramp to zero, so the train never snaps off
  const TRAIN_AMP = 0.92;

  // The terminal burst. Deep enough into the atmosphere the pressure on the
  // leading face beats the strength of the rock and it comes apart; the
  // fragments expose far more surface to the air at once, ablation spikes and
  // the thing flares — usually the brightest instant of the whole event —
  // then burns out fast. That is what separates a bolide from a fireball.
  // Rendered a touch earlier and a good deal softer than nature: a real
  // terminal flash is near instantaneous, and at web frame rates
  // instantaneous is indistinguishable from a dropped frame. It rises slower
  // than it collapses, which is the part that reads as an event rather than
  // a flicker, and it stays under the launch brightness so it never looks
  // like a second meteor.
  const BURST_AT = 0.74;                  // fraction of the path where it lets go
  const BURST_UP = 0.09, BURST_DN = 0.075;   // rise wider than the collapse

  // How hard the green one lights the sky around it. GLOW_RIDE rides the
  // meteor's own brightness; GLOW_FLASH is what the terminal burst adds, and
  // it dominates, because the flare is the moment a real fireball floods the
  // ground. Capped so the sky lifts rather than washes out.
  const glow = document.getElementById('night-glow');
  const GLOW_RIDE = 0.10, GLOW_FLASH = 0.26, GLOW_MAX = 0.30;
  const lightSky = (x, y, v, k = 1) => {
    if (!glow) return;
    if (v > 0.002) glow.style.transform =
      `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${k})`;
    glow.style.opacity = v.toFixed(3);
  };
  // Set once per flight, not per frame: the gradient would have to repaint,
  // and the glow only matters around the burst anyway, so it takes the colour
  // the meteor will be when it flares.
  const glowColour = (pal, at = BURST_AT) => {
    if (glow) glow.style.setProperty('--glow-rgb', rgb(pal, at));
  };
  const burst = (p) => {
    const d = p - BURST_AT;
    const x = Math.abs(d) / (d < 0 ? BURST_UP : BURST_DN);
    return x >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * x));
  };
  // How brightly the meteor burned at a given point of its path: in fast, out
  // slow, with the flare on top. The head reads this at p. The train reads it
  // at EVERY point behind, because a train is a record of what was shed, and
  // what was shed at a point is what the meteor was burning there. That is
  // what makes the far end of the train taper away to nothing — by then there
  // was almost nothing left to shed — and it is why the glowing tip never
  // comes to a dead stop. It goes out as it arrives, instead of halting at
  // full brightness the instant the head reaches the end of the path.
  const lit = (s) => Math.min(1,
    (s < 0.12 ? s / 0.12 : Math.max(0, 1 - (s - 0.12) / 0.88)) + burst(s) * 0.5);

  // The copy and the night photo paint OVER this canvas — the ink is the
  // section's first child, the grid comes after it and neither carries a
  // z-index — so a streak that flies into the figure is simply gone, and one
  // that only clips it dies halfway across the sky. Every path is resampled
  // until it is in open sky, against a rect measured live so it follows the
  // layout instead of trusting a number written here. This barely moves where
  // meteors appear (the ones that flew into the photo were never visible
  // anyway) — it stops them vanishing mid-flight.
  const blocked = () => {
    // the PICTURE, not the <figure> — the figure also wraps the caption strip
    // and the gap above it, some 32px of empty page that occludes nothing
    const win = section.querySelector('.night-window');
    if (!win) return null;
    const c = canvas.getBoundingClientRect(), f = win.getBoundingClientRect();
    if (!f.width || !f.height) return null;
    return [f.left - c.left, f.top - c.top, f.right - c.left, f.bottom - c.top];
  };
  // An exact segment-versus-rectangle test (Liang–Barsky), not nine samples
  // along the path. Sampling left gaps between the sample points, and those
  // gaps had to be covered by a fat margin — which is what made streaks pull
  // up well short of the picture. Tested over the whole DRAWN extent: the
  // tail trails len behind the start, so the segment starts there rather than
  // at the head's first position. EDGE only has to clear the drawn line
  // itself (a 2.4px stroke, a nucleus under 4px across at full burst); the
  // head's bloom is soft-edged light and may fall behind the picture, which
  // is what light does.
  const EDGE = 4;
  const clearOf = (b, m) => {
    if (!b) return true;
    const xmin = b[0] - EDGE, ymin = b[1] - EDGE, xmax = b[2] + EDGE, ymax = b[3] + EDGE;
    const ax = m.x0 - m.ux * m.len, ay = m.y0 - m.uy * m.len;
    const dx = m.ux * (m.travel + m.len), dy = m.uy * (m.travel + m.len);
    const P = [-dx, dx, -dy, dy];
    const Q = [ax - xmin, xmax - ax, ay - ymin, ymax - ay];
    let t0 = 0, t1 = 1;
    for (let i = 0; i < 4; i++) {
      if (P[i] === 0) { if (Q[i] < 0) return true; continue; }   // parallel, outside that slab
      const r = Q[i] / P[i];
      if (P[i] < 0) { if (r > t1) return true; if (r > t0) t0 = r; }
      else { if (r < t0) return true; if (r < t1) t1 = r; }
    }
    return false;                                                // the streak would enter the picture
  };

  // one streak: a head travelling a straight line, with a tapered tail
  // trailing behind it along the same heading
  const draft = (pal) => {
    const leftward = Math.random() < 0.35;
    const ang = (18 + Math.random() * 20) * Math.PI / 180;      // below horizontal
    const ux = (leftward ? -1 : 1) * Math.cos(ang), uy = Math.sin(ang);
    const travel = pal ? 300 + Math.random() * 240 : 240 + Math.random() * 220;
    const len = pal ? 150 + Math.random() * 110 : 90 + Math.random() * 90;  // tail length
    const x0 = leftward ? w * (0.45 + Math.random() * 0.5) : w * (0.05 + Math.random() * 0.5);
    // 0.28 is where the sky's alpha mask has opened up; a green starts in the
    // top half of that band so most drafts clear the figure on the first go
    const y0 = h * (0.28 + Math.random() * (pal ? 0.18 : 0.38));
    const dur = pal ? 780 + Math.random() * 320 : 440 + Math.random() * 280;
    return {
      x0, y0, ux, uy, len, travel, dur, pal,
      life: dur + (pal ? TRAIN_MS : 0),
      t0: performance.now(),
      prev: null, box: null
    };
  };

  // A supernova has no path, so it borrows the meteor's shape with a travel
  // and a tail of zero: clearOf then degenerates into a point-in-rectangle
  // test and keeps it out of the picture for free. It sits in the band above
  // the copy, where the sky's mask is fully open and nothing paints over it —
  // a streak crossing the headline is gone in half a second, but a point
  // hanging behind a letter for five is just missing.
  const draftNova = () => {
    // The shell is not a smooth bubble — look at the Crab and it is all
    // shredded filaments. These are fixed at spawn so they expand WITH the
    // shell rather than boiling about, and they start well out from the
    // centre: spokes running from the middle would read as a firework.
    const fil = [];
    const n = 15 + (Math.random() * 8 | 0);
    for (let i = 0; i < n; i++) fil.push({
      t: (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.9,   // uneven, or it reads as a sun symbol
      a: 0.42 + Math.random() * 0.30,
      b: 0.92 + Math.random() * 0.34,
      w: 0.05 + Math.random() * 0.17,
      lw: 0.7 + Math.random() * 1.9
    });
    // The rim is built from clumps rather than drawn as a ring. A clean
    // radial gradient gives a smoke ring; the real thing is lumpy and torn,
    // brighter on one side than the other, and shot through with different
    // colours — the Crab is teal through the middle with gold and rust at the
    // edges. Each clump keeps its own angle, distance and hue for the whole
    // flight, so the shell expands rather than boiling.
    const HUES = ['255,150,140', '255,150,140', '255,186,126', '255,170,132',
                  '255,196,150', '150,232,212', '186,236,190'];
    const clump = [];
    const cn = 13 + (Math.random() * 6 | 0);
    let ang = Math.random() * Math.PI * 2;
    for (let i = 0; i < cn; i++) {
      ang += (Math.PI * 2 / cn) * (0.55 + Math.random() * 0.9);
      clump.push({
        t: ang,
        r: 0.80 + Math.random() * 0.26,
        s: 0.20 + Math.random() * 0.22,
        a: 0.10 + Math.random() * 0.17,
        c: HUES[Math.random() * HUES.length | 0]
      });
    }
    return {
      nova: true, pal: NOVA, fil, clump,
      // The sky's own alpha mask only reaches full opacity at 22% of the SKY's
      // height — y = 0.355 of this canvas, since the canvas is 62% of it — so
      // anything centred above that is drawn into the fade and arrives washed
      // out. The band starts below it. novaClear then does the rest: with the
      // headline occupying the left, the open sky on this layout is the upper
      // right, and that is where most of these end up.
      x0: w * (0.08 + Math.random() * 0.84),
      y0: h * (0.36 + Math.random() * 0.075),
      ux: 0, uy: 0, len: 0, travel: 0,
      dur: NOVA_RISE, life: NOVA_LIFE,
      t0: performance.now(), prev: null, box: null
    };
  };

  // A remnant is wider than a streak and it sits still for seconds, so it has
  // to keep off the words as well as the picture — a meteor crossing the
  // headline is gone in half a second, a nebula parked behind it is broken.
  //
  // The HEADING, though, not the whole .night-copy cell. That cell is a grid
  // track running most of the section's height and it is mostly empty: its
  // top edge is the small "night mode" label, and the headline itself starts
  // 50px below that. Avoiding the cell threw away all of the sky over the
  // left-hand column, which is why these only ever turned up on the right.
  // The label is a thin line of small caps and the faint outer edge of the
  // shell passing behind it costs nothing.
  const novaClear = (m) => {
    // The clearance is the shell's BRIGHT reach, not its absolute outermost
    // pixel. A clump's gradient runs to zero at its rim, so demanding room for
    // that last transparent millimetre only costs sky — and the sky it costs
    // is the left-hand side, where the headline sits higher than the picture
    // does on the right.
    const R = NOVA_R * 1.18 + 8;
    const c = canvas.getBoundingClientRect();
    for (const sel of ['.night-window', '.night-copy h2']) {
      const el = section.querySelector(sel);
      if (!el) continue;
      const f = el.getBoundingClientRect();
      if (!f.width) continue;
      if (m.x0 + R > f.left - c.left && m.x0 - R < f.right - c.left &&
          m.y0 + R > f.top - c.top && m.y0 - R < f.bottom - c.top) return false;
    }
    return true;
  };

  // The flash goes first and the shell outlives it — which is the whole shape
  // of the thing. A brilliant blue-white core, a rose shell pushing outward
  // and slowing as it goes, filaments tearing through it, and a blue interior
  // lit from inside. It never moves. That is the point: everything else in
  // this sky travels.
  const renderNova = (m, now) => {
    const e = now - m.t0;
    const up = Math.min(1, e / NOVA_RISE);
    const flash = up * up * (3 - 2 * up)
                * (e <= NOVA_RISE ? 1 : Math.exp(-(e - NOVA_RISE) / NOVA_FLASH_TAU));
    const su = Math.max(0, Math.min(1, (e - NOVA_SHELL_IN) / NOVA_SHELL_RUN));
    const R = 5 + (NOVA_R - 5) * (1 - (1 - su) * (1 - su));      // expands, decelerating
    const out = Math.min(1, (m.life - e) / NOVA_OUT);
    const shell = Math.min(1, Math.max(0, e - NOVA_SHELL_IN) / 300)
                * Math.exp(-Math.max(0, e - NOVA_RISE) / NOVA_TAU) * out;
    const core = flash * out;
    const c = rgb(m.pal, e / m.life);

    if (!m.box) m.box = [m.x0 - 130, m.y0 - 130, 260, 260];
    ctx.clearRect(m.box[0], m.box[1], m.box[2], m.box[3]);
    ctx.globalCompositeOperation = 'lighter';

    if (shell > 0.003) {
      // the interior, lit from inside
      const gi = ctx.createRadialGradient(m.x0, m.y0, 0, m.x0, m.y0, R * 1.05);
      gi.addColorStop(0, `rgba(140,196,255,${(0.26 * shell).toFixed(3)})`);
      gi.addColorStop(0.55, `rgba(104,164,246,${(0.13 * shell).toFixed(3)})`);
      gi.addColorStop(1, 'rgba(80,130,220,0)');
      ctx.fillStyle = gi;
      ctx.beginPath(); ctx.arc(m.x0, m.y0, R * 1.05, 0, Math.PI * 2); ctx.fill();

      // a faint even ring underneath, only to bind the clumps into one object
      const gr = ctx.createRadialGradient(m.x0, m.y0, 0, m.x0, m.y0, R * 1.24);
      gr.addColorStop(0, 'rgba(255,150,140,0)');
      gr.addColorStop(0.62, `rgba(255,150,140,${(0.03 * shell).toFixed(3)})`);
      gr.addColorStop(0.84, `rgba(255,158,146,${(0.13 * shell).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(255,200,150,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(m.x0, m.y0, R * 1.24, 0, Math.PI * 2); ctx.fill();

      // and the shell proper: lumps of ejecta sitting on the rim at their own
      // distances, in their own colours
      for (const k of m.clump) {
        const kx = m.x0 + Math.cos(k.t) * R * k.r, ky = m.y0 + Math.sin(k.t) * R * k.r;
        const kr = Math.max(3, R * k.s);
        const gk = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
        gk.addColorStop(0, `rgba(${k.c},${(k.a * shell).toFixed(3)})`);
        gk.addColorStop(0.55, `rgba(${k.c},${(k.a * 0.38 * shell).toFixed(3)})`);
        gk.addColorStop(1, `rgba(${k.c},0)`);
        ctx.fillStyle = gk;
        ctx.beginPath(); ctx.arc(kx, ky, kr, 0, Math.PI * 2); ctx.fill();
      }

      ctx.lineCap = 'round';
      for (const f of m.fil) {
        const cx = Math.cos(f.t), cy = Math.sin(f.t);
        const ax = m.x0 + cx * R * f.a, ay = m.y0 + cy * R * f.a;
        const bx = m.x0 + cx * R * f.b, by = m.y0 + cy * R * f.b;
        const gf = ctx.createLinearGradient(ax, ay, bx, by);
        gf.addColorStop(0, 'rgba(255,192,132,0)');
        gf.addColorStop(0.45, `rgba(255,178,132,${(f.w * shell).toFixed(3)})`);
        gf.addColorStop(1, 'rgba(255,150,140,0)');
        ctx.strokeStyle = gf; ctx.lineWidth = f.lw;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
    }

    if (core > 0.003) {
      const halo = ctx.createRadialGradient(m.x0, m.y0, 0, m.x0, m.y0, 46);
      halo.addColorStop(0, `rgba(${c},${(0.32 * core).toFixed(3)})`);
      halo.addColorStop(0.3, `rgba(${c},${(0.10 * core).toFixed(3)})`);
      halo.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(m.x0, m.y0, 46, 0, Math.PI * 2); ctx.fill();

      const hot = ctx.createRadialGradient(m.x0, m.y0, 0, m.x0, m.y0, 10);
      hot.addColorStop(0, `rgba(255,255,255,${(0.95 * core).toFixed(3)})`);
      hot.addColorStop(0.45, `rgba(${c},${(0.5 * core).toFixed(3)})`);
      hot.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = hot;
      ctx.beginPath(); ctx.arc(m.x0, m.y0, 10, 0, Math.PI * 2); ctx.fill();

      const arm = 52 * core;
      ctx.lineWidth = 1.1; ctx.lineCap = 'butt';
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const g2 = ctx.createLinearGradient(m.x0 - dx * arm, m.y0 - dy * arm,
                                            m.x0 + dx * arm, m.y0 + dy * arm);
        g2.addColorStop(0, `rgba(${c},0)`);
        g2.addColorStop(0.5, `rgba(255,255,255,${(0.5 * core).toFixed(3)})`);
        g2.addColorStop(1, `rgba(${c},0)`);
        ctx.strokeStyle = g2;
        ctx.beginPath();
        ctx.moveTo(m.x0 - dx * arm, m.y0 - dy * arm);
        ctx.lineTo(m.x0 + dx * arm, m.y0 + dy * arm);
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    if (core > 0.003) {
      ctx.fillStyle = `rgba(255,255,255,${core.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(m.x0, m.y0, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    // SN 1006 cast faint shadows, so it does light the sky — but it is a
    // point at stellar distance, not something burning overhead, so the pool
    // is a fraction of a fireball's
    lightSky(m.x0, m.y0, 0.13 * Math.max(core, shell * 0.5), 0.34);
    return e < m.life;
  };

  const spawn = (pal) => {
    if (pal && pal.nova) {
      let m = draftNova();
      for (let tries = 0; tries < 60 && !novaClear(m); tries++) m = draftNova();
      return m;
    }
    const b = blocked();
    let m = draft(pal);
    for (let tries = 0; tries < 40 && !clearOf(b, m); tries++) m = draft(pal);
    return m;
  };

  const render = (m, now) => {
    if (m.nova) return renderNova(m, now);
    const e = now - m.t0;
    const p = Math.min(1, e / m.dur);
    // in fast, out slow — a meteor is brightest just after it appears
    const b = m.pal ? burst(p) : 0;
    const a = m.pal ? lit(p)
                    : (p < 0.12 ? p / 0.12 : Math.max(0, 1 - (p - 0.12) / 0.88));
    const hx = m.x0 + m.ux * m.travel * p, hy = m.y0 + m.uy * m.travel * p;
    if (m.pal) lightSky(hx, hy, Math.min(GLOW_MAX, a * GLOW_RIDE + b * GLOW_FLASH));
    const tx = hx - m.ux * m.len, ty = hy - m.uy * m.len;

    if (m.pal) {
      // the train outlives the head, over ground a per-frame dirty rect has
      // already released — so a green flight owns one box, the whole path,
      // and clears that whole box each frame instead
      if (!m.box) {
        const ex = m.x0 + m.ux * m.travel, ey = m.y0 + m.uy * m.travel;
        const pad = m.len + 52;   // room for the bloom at full burst
        m.box = [Math.min(m.x0, ex) - pad, Math.min(m.y0, ey) - pad,
                 Math.abs(ex - m.x0) + pad * 2, Math.abs(ey - m.y0) + pad * 2];
      }
      ctx.clearRect(m.box[0], m.box[1], m.box[2], m.box[3]);
    } else {
      // clear only what was drawn last frame
      if (m.prev) ctx.clearRect(m.prev[0], m.prev[1], m.prev[2], m.prev[3]);
      const pad = 6;
      m.prev = [Math.min(hx, tx) - pad, Math.min(hy, ty) - pad,
                Math.abs(hx - tx) + pad * 2, Math.abs(hy - ty) + pad * 2];
    }

    // the persistent train, under everything else: each point on the path
    // starts decaying from the moment the head passes IT, so the ghost fades
    // from the origin down rather than dimming all at once
    if (m.pal && p > 0.02) {
      const out = Math.min(1, (m.life - e) / TRAIN_OUT);
      const g = ctx.createLinearGradient(m.x0, m.y0, hx, hy);
      for (let i = 0; i <= 10; i++) {
        const q = i / 10;                               // fraction of the segment drawn so far
        const s = q * p;                                // ...as a fraction of the whole path
        const age = Math.max(0, e - s * m.dur);         // how long ago the head passed it
        const ta = TRAIN_AMP * lit(s) * Math.exp(-age / TRAIN_TAU) * out;
        // the train carries the colour the meteor was burning at that point,
        // so the ghost is green where it came in and gold where it went out
        g.addColorStop(q, `rgba(${rgb(m.pal, s)},${ta.toFixed(3)})`);
      }
      ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.x0, m.y0); ctx.lineTo(hx, hy); ctx.stroke();
    }

    const g = ctx.createLinearGradient(hx, hy, tx, ty);
    if (m.pal) {
      // White-hot core in a coloured sheath — the colour is the glowing air
      // column and what is coming off the body, not the incandescent head.
      // Head and tail are read at their own points on the path, so the streak
      // itself carries the handover: the tail is still the high-altitude
      // colour while the head has already moved on.
      const cH = rgb(m.pal, p), cT = rgb(m.pal, Math.max(0, p - m.len / m.travel));
      g.addColorStop(0, `rgba(255,255,252,${a.toFixed(3)})`);
      g.addColorStop(0.10, `rgba(${cH},${(0.88 * a).toFixed(3)})`);
      g.addColorStop(0.34, `rgba(${cT},${(0.52 * a).toFixed(3)})`);
      g.addColorStop(1, `rgba(${cT},0)`);
    } else {
      g.addColorStop(0, `rgba(255,248,234,${(0.95 * a).toFixed(3)})`);
      g.addColorStop(0.3, `rgba(226,235,255,${(0.34 * a).toFixed(3)})`);
      g.addColorStop(1, 'rgba(214,228,255,0)');
    }
    ctx.strokeStyle = g; ctx.lineWidth = m.pal ? 2.4 : 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();

    // The head of a real fireball is the light source — bright enough at these
    // magnitudes to throw a shadow on the ground — and observers describe a
    // hot core inside a glow rather than a point. So it is built in three
    // layers, added rather than painted over (composite 'lighter') because it
    // is emitted light: a wide bloom, the coma burning around the body, and
    // the white-hot nucleus. The green concentrates here and in the wake just
    // behind, which is where the excited oxygen actually is.
    if (m.pal && a > 0) {
      const c = rgb(m.pal, p);
      ctx.globalCompositeOperation = 'lighter';
      const br = 30 * (1 + 0.55 * b);
      const bloom = ctx.createRadialGradient(hx, hy, 0, hx, hy, br);
      bloom.addColorStop(0, `rgba(${c},${(0.40 * a).toFixed(3)})`);
      bloom.addColorStop(0.34, `rgba(${c},${(0.15 * a).toFixed(3)})`);
      bloom.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = bloom;
      ctx.beginPath(); ctx.arc(hx, hy, br, 0, Math.PI * 2); ctx.fill();
      const cr = 10 * (1 + 0.35 * b);
      const coma = ctx.createRadialGradient(hx, hy, 0, hx, hy, cr);
      coma.addColorStop(0, `rgba(255,255,252,${(0.92 * a).toFixed(3)})`);
      coma.addColorStop(0.38, `rgba(${c},${(0.52 * a).toFixed(3)})`);
      coma.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = coma;
      ctx.beginPath(); ctx.arc(hx, hy, cr, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = `rgba(255,250,240,${a.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(hx, hy, m.pal ? 2.4 * (1 + 0.5 * b) : 1.25, 0, Math.PI * 2); ctx.fill();
    return e < m.life;
  };

  // The first streak of a visit is on a fixed short fuse, not the ambient
  // interval: it's the one that teaches you the sky does something, and it
  // buys patience for the slower rhythm afterwards. Every arrival gets one,
  // including coming back to the section later.
  const FIRST = DEBUG ? 500 : 3000;
  const AMBIENT = DEBUG ? () => 700 + Math.random() * 300
                        : () => 7000 + Math.random() * 7000;

  let timer = 0, raf = 0, onScreen = false;
  // Rolled rarest first, so a commoner one cannot shadow it. Two guard rails
  // on all three: never the first streak of a visit (that one teaches you the
  // sky does something, and a coloured opener would make the eggs findable by
  // reloading), and never two running — back to back reads as a bug rather
  // than as a rarity.
  let flights = 0, lastFire = false;
  const pick = () => {
    if (flights === 0 && !DEBUG) return null;
    if (lastFire) return null;
    if (Math.random() < 1 / NOVA.odds) return NOVA;
    if (Math.random() < 1 / VIOLET.odds) return VIOLET;
    if (Math.random() < 1 / GREEN.odds) return GREEN;
    return null;
  };
  const disarm = () => { clearTimeout(timer); timer = 0; };
  const arm = (delay) => {
    disarm();
    if (!onScreen) return;
    timer = setTimeout(() => {
      timer = 0;
      if (!onScreen || document.hidden) return;
      // the section plays itself to night on arrival and the ink takes 1.3s;
      // until then the whole sky sits at opacity 0, so wait rather than spend
      // a meteor on a sky nobody can see
      if (!section.classList.contains('is-night')) return arm(300);
      fly();
    }, delay);
  };
  const schedule = () => arm(AMBIENT());

  const fly = (force) => {
    if (!size()) return schedule();
    const m = spawn(force === undefined ? pick() : force);
    flights++; lastFire = !!m.pal;
    if (m.pal) glowColour(m.pal, m.nova ? 0 : BURST_AT);
    const step = () => {
      if (!render(m, performance.now())) {
        ctx.clearRect(0, 0, w, h);
        lightSky(0, 0, 0);
        raf = 0;
        return schedule();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    if (visible === onScreen) return;          // ignore duplicate edges
    onScreen = visible;
    if (onScreen) {
      flights = 0; lastFire = false;    // each arrival gets its plain opener
      arm(FIRST);
    } else {
      disarm();
      cancelAnimationFrame(raf); raf = 0;
      if (w && h) ctx.clearRect(0, 0, w, h);
      lightSky(0, 0, 0);
    }
  }, { threshold: 0.05 }).observe(section);

  addEventListener('resize', () => { if (!raf) size(); });

  // ── TWO WAYS IN, and they are the dots over the i's: the tittle of the "i"
  // in "it" drops a green one, the tittle of the "i" in "lit" drops a violet.
  // They already look like the thing they call down.
  //
  // There is nothing in the HTML to hang this on. typesetHeadlines() rebuilds
  // the heading out of bare text nodes (keeping only the <em> runs) and
  // re-splits it on every resize, so a span written into the markup is
  // flattened on the first pass. Each target character is therefore re-wrapped
  // after every split, which a MutationObserver watches for; it disconnects
  // around its own edit so it does not retrigger on it. The words are found by
  // regex over the heading's own text rather than by position, so rewording
  // the sentence moves the targets instead of breaking them.
  //
  // Night only — in Day the ink sits at opacity 0 and there is no sky to drop
  // anything through — never while something is already flying, and never when
  // the "click" is really the end of a drag across the text.
  const head = section.querySelector('.night-copy h2');
  if (head) {
    const TARGETS = [[/\bit\b/, GREEN], [/\blit\b/, VIOLET], [/\bnight\b/, NOVA]];
    // The tittle's centre inside the glyph's inline box, as fractions of that
    // box. Measured off the rendered face, not guessed: the box is a whole
    // line-height tall and the dot sits right at the top of it, 9% down —
    // nearly all of that box is empty ascender space above and descender
    // space below. TIT_R is the reach of the target, a little wider than the
    // 0.12em dot so it can be hit on purpose without being hit by accident.
    const TIT_X = 0.50, TIT_Y = 0.092, TIT_R = 0.20;
    let dots = [], litEl = null;

    const wrapChar = (at) => {
      const walk = document.createTreeWalker(head, NodeFilter.SHOW_TEXT);
      let n, acc = 0;
      while ((n = walk.nextNode())) {
        const len = n.textContent.length;
        if (at < acc + len) {
          const ch = n.splitText(at - acc);
          ch.splitText(1);
          const span = document.createElement('span');
          span.className = 'night-dot';
          span.textContent = ch.textContent;
          ch.replaceWith(span);
          return span;
        }
        acc += len;
      }
      return null;
    };

    const markDots = () => {
      if (head.querySelector('.night-dot')) return;
      const text = head.textContent;
      const found = [];
      for (const [re, pal] of TARGETS) {
        const hit = re.exec(text);
        if (hit) found.push({ at: hit.index + hit[0].indexOf('i'), pal });
      }
      // later one first: wrapping a character would move the other's offset
      found.sort((a, b) => b.at - a.at);
      litEl = null;   // the old spans are gone; do not hold a dead node
      dots = found.map(({ at, pal }) => ({ el: wrapChar(at), pal })).filter((d) => d.el);
    };

    const mo = new MutationObserver(() => {
      mo.disconnect(); markDots(); mo.observe(head, { childList: true, subtree: true });
    });
    markDots();
    mo.observe(head, { childList: true, subtree: true });

    const onTittle = (el, x, y) => {
      const r = el.getBoundingClientRect();
      if (!r.height) return false;
      const cx = r.left + r.width * TIT_X, cy = r.top + r.height * TIT_Y;
      return Math.hypot(x - cx, y - cy) <= Math.max(11, r.height * TIT_R);
    };

    // Hover is driven from the same hit test as the click, not from :hover on
    // the span — the span is the whole letter, and a swell that fires anywhere
    // on the "i" while only the dot is clickable would be a lie. So the cursor
    // and the swell appear exactly where the click will land.
    const setLit = (el) => {
      if (litEl === el) return;
      if (litEl) litEl.classList.remove('is-lit');
      litEl = el;
      if (litEl) litEl.classList.add('is-lit');
    };
    head.addEventListener('mousemove', (e) => {
      if (!section.classList.contains('is-night')) return setLit(null);
      const d = dots.find((d) => onTittle(d.el, e.clientX, e.clientY));
      setLit(d ? d.el : null);
    });
    head.addEventListener('mouseleave', () => setLit(null));

    let px = 0, py = 0;
    head.addEventListener('pointerdown', (e) => { px = e.clientX; py = e.clientY; });
    head.addEventListener('click', (e) => {
      if (Math.hypot(e.clientX - px, e.clientY - py) > 4) return;   // a drag
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;                          // selecting text
      if (!section.classList.contains('is-night')) return;
      const d = dots.find((d) => onTittle(d.el, e.clientX, e.clientY));
      if (!d) return;
      // A deliberate click takes the sky over rather than queuing behind
      // whatever happens to be up there. Refusing while something flies
      // would swallow a good fraction of them — an ambient flight lasts up
      // to three and a half seconds with its train — and a button that does
      // nothing a quarter of the time reads as no button at all.
      if (raf) { cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, w, h); lightSky(0, 0, 0); }
      disarm();
      fly(d.pal);
    });
  }

  // ?meteors=debug — the lab. Streaks land about once a second and one in
  // three is green, so the rare one can actually be judged and tuned instead
  // of waited out; __meteor(true) fires one on demand. None of this exists on
  // a normal visit, and nothing below runs without the flag in the URL.
  if (DEBUG) window.__meteor = (which = 'green') => {
    if (raf) return false;
    disarm();
    fly(which === 'violet' ? VIOLET : which === 'nova' ? NOVA
        : which === 'plain' ? null : GREEN);
    return true;
  };
})();

// ── NAV ON INK — while an ink region is under the fixed bar (the night
// section in Night, or the closing block) the bar smokes over instead of
// floating as a paper strip. One rect check per scroll frame.
(function navOnInk() {
  const nav = document.querySelector('nav');
  const night = document.getElementById('night');
  const ink = night?.querySelector('.night-ink');
  const closing = document.querySelector('.closing');
  if (!nav || (!ink && !closing)) return;
  let raf = 0;
  // The ink's box is mostly fade: its mask is a smoothstep over the top 22%
  // and bottom 21%, and the scroll ramps in styles.css take the whole layer
  // out over the last 80% of its exit. Going by the box alone kept the bar
  // dark well into the catalog, over paper. So sample how dark the ink
  // actually is at the bar's foot and flip at half.
  const MASK_IN = 0.22, MASK_OUT = 0.79;
  const ramped = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: view()');
  const smooth = (x) => x * x * (3 - 2 * x);
  const inkDarkUnder = (navBottom) => {
    const r = ink.getBoundingClientRect();
    if (r.height <= 0 || r.top >= navBottom || r.bottom <= 0) return false;
    const t = (navBottom - r.top) / r.height;
    let a = smooth(t < MASK_IN ? t / MASK_IN : t > MASK_OUT ? (1 - t) / (1 - MASK_OUT) : 1);
    if (ramped) {
      const entered = (innerHeight - r.top) / r.height;   // view() entry 0%→100%
      const exited = -r.top / r.height;                   // view() exit 0%→100%
      if (entered < 0.8) { const q = 1 - Math.max(0, entered / 0.8); a *= 1 - q * q; }   // ramp in, ease-out
      if (exited > 0.2)  { const q = Math.min(1, (exited - 0.2) / 0.8); a *= 1 - q * q; } // ramp out, ease-in
    }
    return a >= 0.5;
  };
  const check = () => {
    raf = 0;
    const navBottom = nav.getBoundingClientRect().bottom;
    const under = (el) => { const r = el.getBoundingClientRect(); return r.top < navBottom && r.bottom > 0; };
    const onNight = !!(ink && night.classList.contains('is-night') && inkDarkUnder(navBottom));
    const on = onNight || (closing && under(closing));
    document.documentElement.classList.toggle('nav-on-ink', !!on);
    document.documentElement.classList.toggle('nav-on-night', onNight);
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  night?.querySelectorAll('.night-btn').forEach((b) => b.addEventListener('click', () => setTimeout(check, 0)));
  if (night && window.MutationObserver) new MutationObserver(schedule).observe(night, { attributes: true, attributeFilter: ['class'] });
  check();
})();
