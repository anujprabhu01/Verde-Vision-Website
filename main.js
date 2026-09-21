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


// ── Announcement banner — dismissal is per page view; a refresh brings it back.
document.getElementById('banner-close')?.addEventListener('click', () => {
  document.documentElement.classList.add('banner-dismissed');
});

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
    const io = new IntersectionObserver((entries) => {
      track.style.animationPlayState = entries[0].isIntersecting ? 'running' : 'paused';
    });
    io.observe(row);
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
