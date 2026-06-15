// Always open the landing page at the top — don't let the browser restore a
// mid-page scroll on reload (it also pre-triggers on-scroll reveals), and
// don't let a leftover #section hash (from in-page nav) jump us back there.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (window.location.hash) {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
{
  // The browser can (re)apply its remembered/fragment scroll position after
  // this script runs — once webfonts swap, or once the Plant Library's 3D
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

  const onDown = (e) => {
    dragging = true;
    baSlider.classList.add('is-grabbing');
    cancelAutoplay();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = baSlider.getBoundingClientRect();
    const targetPct = ((x - rect.left) / rect.width) * 100;
    // Smoothly glide to where they pressed; if they actually drag, onMove cancels this.
    snapTo(targetPct);
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!dragging) return;
    cancelSnap();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    setPosition(x);
  };
  const onUp = () => {
    dragging = false;
    baSlider.classList.remove('is-grabbing');
  };

  baSlider.addEventListener('mousedown', onDown);
  baSlider.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);

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
    btn.addEventListener('mousedown', stop);
    btn.addEventListener('touchstart', stop);
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


// ── Demo booking calendar ──
const TIMES = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

let currentYear, currentMonth, selectedDate = null, selectedTime = null;

const calDays     = document.getElementById('cal-days');
const calLabel    = document.getElementById('cal-month-label');
const calPrev     = document.getElementById('cal-prev');
const calNext     = document.getElementById('cal-next');
const timeSlotsEl = document.getElementById('time-slots');
const selectedDateLabel = document.getElementById('selected-date-label');
const confirmBtn  = document.getElementById('confirm-btn');
const demoForm    = document.getElementById('demo-form');
const bookingCard = document.getElementById('booking-card');
const bookingConf = document.getElementById('booking-confirmation');
const confirmDetails = document.getElementById('confirm-details');

function init() {
  if (!calDays || !calLabel) return; // page without the booking widget
  const now = new Date();
  currentYear  = now.getFullYear();
  currentMonth = now.getMonth();
  renderCalendar();
}

function renderCalendar() {
  calLabel.textContent = `${MONTHS[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  calDays.innerHTML = '';

  // Empty cells before the 1st
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('button');
    empty.className = 'cal-day empty';
    empty.disabled = true;
    calDays.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isPast    = date < today;

    const btn = document.createElement('button');
    btn.className = 'cal-day';
    btn.textContent = d;
    btn.disabled = isWeekend || isPast;

    const isSelected = selectedDate &&
      selectedDate.getFullYear() === currentYear &&
      selectedDate.getMonth()    === currentMonth &&
      selectedDate.getDate()     === d;

    if (isSelected) btn.classList.add('selected');

    btn.addEventListener('click', () => selectDate(new Date(currentYear, currentMonth, d)));
    calDays.appendChild(btn);
  }
}

function selectDate(date) {
  selectedDate = date;
  selectedTime = null;
  renderCalendar();
  renderTimeSlots();
  updateConfirmButton();
}

function renderTimeSlots() {
  const label = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  selectedDateLabel.textContent = `— ${label}`;

  timeSlotsEl.innerHTML = '';
  TIMES.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'time-slot';
    btn.textContent = t;
    btn.addEventListener('click', () => selectTime(t));
    timeSlotsEl.appendChild(btn);
  });
}

function selectTime(time) {
  selectedTime = time;
  document.querySelectorAll('.time-slot').forEach((btn) => {
    btn.classList.toggle('selected', btn.textContent === time);
  });
  updateConfirmButton();
}

function updateConfirmButton() {
  confirmBtn.disabled = !(selectedDate && selectedTime);
}

// ── Replace this URL with your Formspree endpoint ──
// 1. Sign up free at formspree.io
// 2. Create a new form → set email to demos@useverdevision.com
// 3. Paste your endpoint here (e.g. https://formspree.io/f/xxxxxxxx)
const FORMSPREE_URL = 'https://formspree.io/f/xnjlkzde';

demoForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name  = document.getElementById('form-name').value.trim();
  const email = document.getElementById('form-email').value.trim();
  const note  = document.getElementById('form-note').value.trim();
  const label = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Sending…';

  try {
    const res = await fetch(FORMSPREE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        requested_date: label,
        requested_time: selectedTime,
        note: note || '—',
        _subject: `Demo request from ${name} — ${label} at ${selectedTime}`,
      }),
    });

    if (!res.ok) throw new Error('submission failed');

    confirmDetails.textContent = `${name}, we've got you down for ${label} at ${selectedTime}.`;
    bookingCard.style.display = 'none';
    bookingConf.classList.add('visible');
  } catch {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm Booking';
    alert('Something went wrong — please try again or email us at demos@useverdevision.com');
  }
});

calPrev?.addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});

calNext?.addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

init();

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
      ctx.strokeStyle = li % 5 === 0 ? 'rgba(46,93,67,0.22)' : 'rgba(46,93,67,0.11)';
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

  let resizeRaf = null;
  addEventListener('resize', () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => { resizeRaf = null; resize(); });
  });
})();

// ── CREDIBILITY BAR — duplicate the ticker for a seamless -50% loop ──
// The CSS marquee translates the track by -50%; that's only seamless if the
// track holds two identical halves. We clone the authored items once here so
// the markup stays single-source. (No JS → the single set just sits static.)
(function credMarquee() {
  const track = document.getElementById('cred-track');
  if (!track) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const originals = Array.from(track.children);
  originals.forEach((node) => {
    const clone = node.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });
  // Pause the animation while the bar is off-screen so it isn't churning the
  // compositor as you read the rest of the page.
  const bar = track.closest('.cred-bar') || track;
  const io = new IntersectionObserver((entries) => {
    track.style.animationPlayState = entries[0].isIntersecting ? 'running' : 'paused';
  });
  io.observe(bar);
})();

// FEATURES — the palm fronds (grow) and the feature text (rise) are now driven
// entirely by CSS scroll-driven animations (animation-timeline: view()), so they
// animate continuously with scroll position regardless of where the page loads.
// No JS observer needed; see styles.css.
