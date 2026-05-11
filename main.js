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


// ── Cursor-tracking glow for feature & audience cards ──
document.querySelectorAll('.feature-card, .audience-card').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mx', `${x}%`);
    card.style.setProperty('--my', `${y}%`);
  });
});


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

demoForm.addEventListener('submit', async (e) => {
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

calPrev.addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});

calNext.addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

init();

// ── Hero halo breath ──
// A tight green halo wraps the AVP silhouette and slow-breathes. Dots
// closest to the headset rim are the brightest; intensity fades outward
// only. The halo lights the underlying grid dots; its center anchors to
// the headset's bounding rect, recomputed each frame so it tracks scroll.
(() => {
  const canvas = document.querySelector('.grid-lines');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const headsetEl = document.querySelector('.headset-core');
  if (!headsetEl) return;

  const ctx = canvas.getContext('2d');
  const TILE = 28;
  const DOT_OFFSET = 14;
  // The PNG has transparent padding around the AVP silhouette, so the
  // bounding rect is wider/taller than the visible headset. These scales
  // shrink the halo ellipse to hug the actual silhouette edge.
  const SHAPE_SCALE_X = 0.78;
  const SHAPE_SCALE_Y = 0.58;
  const SIGMA_PX = 32;         // halo extent in PIXELS — uniform thickness around the rim
  const PERIOD_MS = 5000;      // slow breath cadence
  const BREATH_MIN = 0.55;     // halo never fades below this fraction of peak
  const PEAK_RADIUS = 1.8;     // dot radius at full intensity (CSS base ~0.9px)
  const BASE_RADIUS = 0.7;
  const PEAK_ALPHA = 0.45;
  const MIN_INTENSITY = 0.05;
  // Vertical mask in normalized-y space: ny is +down. Side halo stays full;
  // the lower portion (where the AVP shadow sits and reflection begins) fades out.
  const MASK_TOP_NY = 0.55;    // above this ny: full intensity
  const MASK_BOT_NY = 1.00;    // below this ny: zero
  const ACCENT = '31, 196, 144';

  let dpr = 1, cols = 0, viewW = 0, viewH = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor((viewW - DOT_OFFSET) / TILE);
  }

  function frame(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const rect = headsetEl.getBoundingClientRect();
    const scrollY = window.scrollY;
    const cxDoc = rect.left + rect.width / 2;
    const cyDoc = rect.top + scrollY + rect.height / 2;

    // Ellipse semi-axes that hug the AVP silhouette inside the PNG's
    // transparent padding (separate X/Y because the asset isn't square).
    const a = (rect.width * 0.5) * SHAPE_SCALE_X;
    const b = (rect.height * 0.5) * SHAPE_SCALE_Y;
    if (a <= 0 || b <= 0) {
      requestAnimationFrame(frame);
      return;
    }

    // Halo extends ~3.5σ in pixels past the silhouette in every direction.
    // For cull tests, expand the bounding box uniformly by that pixel pad.
    const HALO_PAD = 3.5 * SIGMA_PX;
    const maxAxis = Math.max(a, b) + HALO_PAD;

    const screenCY = cyDoc - scrollY;
    if (screenCY < -maxAxis || screenCY > viewH + maxAxis) {
      requestAnimationFrame(frame);
      return;
    }

    // Symmetric breathing: brightness oscillates smoothly between BREATH_MIN and 1.
    const phase = (((now / PERIOD_MS)) % 1 + 1) % 1;
    const breath = BREATH_MIN + (1 - BREATH_MIN) * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));

    const yTop = cyDoc - maxAxis;
    const yBot = cyDoc + maxAxis;
    const jMin = Math.max(0, Math.floor((Math.max(scrollY, yTop) - DOT_OFFSET) / TILE) - 1);
    const jMax = Math.floor((Math.min(scrollY + viewH, yBot) - DOT_OFFSET) / TILE) + 1;

    const xLeft = cxDoc - maxAxis;
    const xRight = cxDoc + maxAxis;
    const iMin = Math.max(0, Math.floor((xLeft - DOT_OFFSET) / TILE) - 1);
    const iMax = Math.min(cols, Math.floor((xRight - DOT_OFFSET) / TILE) + 1);

    const invA = 1 / a;
    const invB = 1 / b;
    const inv2sigPxSq = 1 / (2 * SIGMA_PX * SIGMA_PX);
    // Per-direction outer cutoff in normalized space (depends on local axis).
    const outerDeltaX = HALO_PAD / a;
    const outerDeltaY = HALO_PAD / b;
    const maskRange = MASK_BOT_NY - MASK_TOP_NY;

    for (let j = jMin; j <= jMax; j++) {
      const docY = DOT_OFFSET + j * TILE;
      const screenY = docY - scrollY;
      if (screenY < -8 || screenY > viewH + 8) continue;
      const ny = (docY - cyDoc) * invB;
      const ny2 = ny * ny;

      // Vertical mask: fade out below the AVP so the halo doesn't paint the reflection.
      let vMask;
      if (ny <= MASK_TOP_NY) vMask = 1;
      else if (ny >= MASK_BOT_NY) continue;
      else {
        const t = (ny - MASK_TOP_NY) / maskRange;
        vMask = 1 - t * t * (3 - 2 * t); // smoothstep
      }

      for (let i = iMin; i <= iMax; i++) {
        const docX = DOT_OFFSET + i * TILE;
        const nx = (docX - cxDoc) * invA;
        const nr2 = nx * nx + ny2;
        // Conservative cull using the larger per-direction outer delta.
        const maxOuter = 1 + Math.max(outerDeltaX, outerDeltaY);
        if (nr2 > maxOuter * maxOuter) continue;
        const nr = Math.sqrt(nr2);

        // Halo falloff in PIXEL space so the band has uniform thickness around
        // the rim, contouring the silhouette evenly. Peak inside the ellipse;
        // outside, fade with perpendicular pixel distance to the boundary.
        // (Inner dots are hidden behind the headset image.)
        let halo;
        if (nr > 1) {
          // Local radius along the (nx, ny) direction = distance from center
          // to the ellipse boundary in this direction, in pixels.
          const cosT = nx / nr;
          const sinT = ny / nr;
          const localR = Math.sqrt((cosT * a) * (cosT * a) + (sinT * b) * (sinT * b));
          const pixelDist = (nr - 1) * localR;
          halo = Math.exp(-pixelDist * pixelDist * inv2sigPxSq);
        } else {
          halo = 1;
        }
        const intensity = halo * breath * vMask;
        if (intensity < MIN_INTENSITY) continue;

        const r = BASE_RADIUS + (PEAK_RADIUS - BASE_RADIUS) * intensity;
        const al = PEAK_ALPHA * intensity;
        ctx.fillStyle = `rgba(${ACCENT}, ${al})`;
        ctx.beginPath();
        ctx.arc(docX, screenY, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();

// ── CTA oak tree — grid-snapped silhouette that grows on first reveal ──
(function ctaOakTree() {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const cta = document.querySelector('.cta');
  const svg = document.getElementById('cta-tree');
  if (!cta || !svg) return;

  const dotsG     = svg.querySelector('.cta-tree-dots');
  const branchesG = svg.querySelector('.cta-tree-branches');
  const leavesG   = svg.querySelector('.cta-tree-leaves');

  // Seeded PRNG so the silhouette is consistent run-to-run.
  function makeRand(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Generate an oak: trunk + spreading limbs + sub-branches that dissolve into
  // foliage clusters at the tips. Each step lands on an adjacent grid cell so
  // paths always trace dot-to-dot. Outer canopy is allowed to droop downward.
  function buildOak(cols, rows) {
    const rand = makeRand(0xC0FFEE);
    const cx = Math.floor(cols / 2);
    const trunkBase = rows - 1;
    const trunkTop = Math.max(3, rows - Math.max(5, Math.floor(rows * 0.26)));
    const droopFloor = Math.min(rows - 2, trunkTop + Math.max(2, Math.floor(rows * 0.10)));

    const branches = []; // { points: [[c,r]...], depth }
    const tips = [];     // [{ x, y, depth }]

    // Trunk
    const trunk = [];
    for (let y = trunkBase; y >= trunkTop; y--) trunk.push([cx, y]);
    branches.push({ points: trunk, depth: 0 });

    function inBounds(x, y) { return x >= 1 && x <= cols - 2 && y >= 1 && y <= droopFloor; }

    // Walk a branch outward, possibly upward and (later) drooping back down,
    // possibly forking. dirBias in roughly [-1.6, 1.6]; positive = right.
    function walk(x, y, dirBias, life, depth) {
      const pts = [[x, y]];
      const sgn = Math.sign(dirBias) || (rand() < 0.5 ? -1 : 1);
      const absB = Math.abs(dirBias);
      // Outer/horizontal limbs spend more steps moving sideways.
      const horizChance = Math.min(0.55, 0.18 + absB * 0.22) * (depth === 0 ? 1 : depth === 1 ? 0.85 : 0.7);

      for (let i = 0; i < life; i++) {
        const progress = i / life;
        const r = rand();
        let dx, dy;
        // Drooping: only outer (|bias|>0.3), only at later half of the walk,
        // and only after the limb has climbed away from the trunk crotch.
        const canDroop = depth >= 1 && absB > 0.3 && progress > 0.55 && y < trunkTop - 1;
        if (canDroop && r < 0.22) {
          dx = sgn; dy = 1;
        } else if (r < horizChance + 0.05 && absB > 0.25) {
          dx = sgn; dy = 0;
        } else {
          dy = -1;
          // Probability of stepping right / left / straight up.
          let pR = 0.30 + dirBias * 0.32;
          let pL = 0.30 - dirBias * 0.32;
          pR = Math.max(0.02, Math.min(0.88, pR));
          pL = Math.max(0.02, Math.min(0.88, pL));
          const pS = Math.max(0.05, 1 - pR - pL);
          const total = pR + pL + pS;
          const lean = rand() * total;
          if (lean < pL) dx = -1;
          else if (lean < pL + pS) dx = 0;
          else dx = 1;
        }

        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny)) break;
        x = nx; y = ny;
        pts.push([x, y]);

        // Forks split the branch into multiple twigs — denser at lower depths
        // so the silhouette feels articulated, not just a bunch of straight lines.
        const forkChance = depth === 0 ? 0.36 : depth === 1 ? 0.32 : depth === 2 ? 0.24 : 0.14;
        if (depth < 4 && i > 1 && i < life - 2 && rand() < forkChance) {
          const childBias = Math.max(-1.6, Math.min(1.6, dirBias + (rand() - 0.5) * 1.4));
          const childLife = Math.max(2, Math.floor((life - i) * (0.45 + rand() * 0.4)));
          walk(x, y, childBias, childLife, depth + 1);
        }
      }

      branches.push({ points: pts, depth });
      const tip = pts[pts.length - 1];
      tips.push({ x: tip[0], y: tip[1], depth });
    }

    // Major limbs from trunk top — symmetric spread for an oak silhouette.
    const canopyLife = Math.max(8, Math.floor(trunkTop * 1.05));
    const limbs = [
      { dir: -1.5, life: canopyLife,     from: trunkTop },
      { dir: -1.0, life: canopyLife + 1, from: trunkTop },
      { dir: -0.5, life: canopyLife + 2, from: trunkTop },
      { dir:  0.0, life: canopyLife + 3, from: trunkTop },
      { dir:  0.5, life: canopyLife + 2, from: trunkTop },
      { dir:  1.0, life: canopyLife + 1, from: trunkTop },
      { dir:  1.5, life: canopyLife,     from: trunkTop },
    ];
    limbs.forEach(l => walk(cx, l.from, l.dir, l.life, 0));

    // Low-trunk limbs split off a bit below the crown for the classic spreading
    // oak look — the wide, almost horizontal limbs carry most of the canopy.
    walk(cx, trunkTop + 1, -1.4, Math.max(7, canopyLife - 1), 0);
    walk(cx, trunkTop + 1,  1.4, Math.max(7, canopyLife - 1), 0);
    walk(cx, trunkTop + 2, -1.5, Math.max(6, canopyLife - 2), 0);
    walk(cx, trunkTop + 2,  1.5, Math.max(6, canopyLife - 2), 0);

    return { branches, tips, cols, rows };
  }

  // Build a foliage cluster around a tip cell. Outer/deeper tips get a bigger,
  // looser cloud; inner tips get a small puff. Cells are picked by walking from
  // existing cluster cells to neighbors, so the cloud feels organic.
  function buildLeafCluster(tip, depth, occupied, cols, rows, rand) {
    const radius = depth >= 3 ? 4 : depth === 2 ? 3 : 2;
    const target = depth >= 3 ? 7 + Math.floor(rand() * 4)
                  : depth === 2 ? 5 + Math.floor(rand() * 3)
                  : 3 + Math.floor(rand() * 2);
    const cells = [];
    const seen = new Set();
    const tryAdd = (x, y) => {
      if (x < 1 || x > cols - 2 || y < 1 || y > rows - 1) return false;
      const k = x + ',' + y;
      if (seen.has(k) || occupied.has(k)) return false;
      seen.add(k); occupied.add(k); cells.push([x, y]);
      return true;
    };
    tryAdd(tip.x, tip.y);
    let guard = 0;
    while (cells.length < target && guard++ < 80) {
      const seed = cells[Math.floor(rand() * cells.length)] || [tip.x, tip.y];
      // Bias placement within `radius` of the original tip.
      const dx = Math.floor((rand() - 0.5) * 2 * radius * 0.7);
      const dy = Math.floor((rand() - 0.5) * 2 * radius * 0.7);
      const nx = seed[0] + Math.sign(dx) * (Math.abs(dx) > 0 ? 1 : 0);
      const ny = seed[1] + Math.sign(dy) * (Math.abs(dy) > 0 ? 1 : 0);
      // Must stay within the original radius around the tip itself.
      if (Math.abs(nx - tip.x) <= radius && Math.abs(ny - tip.y) <= radius) {
        tryAdd(nx, ny);
      }
    }
    return cells;
  }

  // Convert a centerline into two parallel offset polylines (left and right
  // edges of a thick branch). For very thin twigs we just return the centerline
  // as a single line.
  function offsetPair(pointsPx, w) {
    if (w < 1.2 || pointsPx.length < 2) return { single: pointsPx };
    const left = [], right = [];
    for (let i = 0; i < pointsPx.length; i++) {
      const p = pointsPx[i];
      const prev = i > 0 ? pointsPx[i - 1] : null;
      const next = i < pointsPx.length - 1 ? pointsPx[i + 1] : null;
      let tx, ty;
      if (prev && next) {
        const ax = p[0] - prev[0], ay = p[1] - prev[1];
        const bx = next[0] - p[0], by = next[1] - p[1];
        const la = Math.hypot(ax, ay) || 1;
        const lb = Math.hypot(bx, by) || 1;
        tx = ax / la + bx / lb;
        ty = ay / la + by / lb;
      } else if (next) {
        tx = next[0] - p[0]; ty = next[1] - p[1];
      } else {
        tx = p[0] - prev[0]; ty = p[1] - prev[1];
      }
      const tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl, ny = tx / tl;
      left.push([p[0] + nx * w / 2, p[1] + ny * w / 2]);
      right.push([p[0] - nx * w / 2, p[1] - ny * w / 2]);
    }
    return { left, right };
  }

  function pathD(pts) {
    let s = '';
    for (let i = 0; i < pts.length; i++) {
      s += (i === 0 ? 'M ' : ' L ') + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
    }
    return s;
  }

  function pathLength(pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i++) {
      l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return l;
  }

  let mounted = false;
  function render() {
    const rect = cta.getBoundingClientRect();
    const W = Math.max(320, Math.round(rect.width));
    const H = Math.max(240, Math.round(rect.height));
    // Denser grid than the body's 28px dots — gives the canopy more resolution.
    const CELL = 22;
    const COLS = Math.max(14, Math.floor(W / CELL));
    const ROWS = Math.max(10, Math.floor(H / CELL));
    const ox = (W - (COLS - 1) * CELL) / 2;
    const oy = H - (ROWS - 1) * CELL - 10;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    dotsG.replaceChildren();
    branchesG.replaceChildren();
    leavesG.replaceChildren();

    const rand = makeRand(0xC0FFEE ^ 0xA17);
    const spec = buildOak(COLS, ROWS);

    // Build leaf clusters around each tip. Track occupied cells so neighbouring
    // tips don't overlap their clusters into mush.
    const occupied = new Set();
    const leafCells = [];
    spec.tips.forEach(t => {
      const cells = buildLeafCluster(t, t.depth, occupied, COLS, ROWS, rand);
      cells.forEach(([c, r]) => leafCells.push({ c, r, depth: t.depth }));
    });
    const leafKeySet = new Set(leafCells.map(({ c, r }) => c + ',' + r));

    // Background dot grid — leaf positions are skipped so leaf circles can
    // replace them with brighter, animated dots.
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cxg = 0; cxg < COLS; cxg++) {
        if (leafKeySet.has(cxg + ',' + cy)) continue;
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', ox + cxg * CELL);
        c.setAttribute('cy', oy + cy * CELL);
        c.setAttribute('r', 1.0);
        dotsG.appendChild(c);
      }
    }

    // Branches: each is rendered as TWO parallel offset polylines so it reads
    // like a hollow stroked tube rather than a single funky line.
    const TOTAL = 5.5;
    const depthDelay = [0.00, 0.85, 1.95, 2.85, 3.55];
    const depthDur   = [0.95, 1.35, 1.10, 0.80, 0.55];
    const widthByDepth = [6.0, 4.2, 3.0, 2.0, 1.4];

    spec.branches.forEach((b, idx) => {
      const isTrunk = idx === 0;
      const depthRaw = isTrunk ? -1 : (b.depth ?? 0);
      const depthIdx = isTrunk ? 0 : Math.min(4, depthRaw + 1);
      const w = widthByDepth[Math.min(widthByDepth.length - 1, depthIdx)];
      const ptsPx = b.points.map(([c, r]) => [ox + c * CELL, oy + r * CELL]);
      const pair = offsetPair(ptsPx, w);
      const sides = pair.single ? [pair.single] : [pair.left, pair.right];
      const delay = isTrunk ? 0 : depthDelay[depthIdx] + Math.random() * 0.22;
      const dur   = isTrunk ? depthDur[0] : depthDur[depthIdx];

      sides.forEach(side => {
        const d = pathD(side);
        const len = pathLength(side);
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.style.setProperty('--len', len);
        path.style.setProperty('--delay', delay + 's');
        path.style.setProperty('--dur', dur + 's');
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        branchesG.appendChild(path);
      });
    });

    // Foliage: clusters bloom from the perimeter inward. Outer (deeper) tips
    // start a touch earlier than inner ones so the canopy fills in like leaves
    // catching sunlight.
    leafCells.forEach(({ c, r, depth }) => {
      const lateral = Math.abs(c - (COLS - 1) / 2) / Math.max(1, (COLS - 1) / 2);
      const depthBoost = depth >= 3 ? 0 : depth === 2 ? 0.10 : 0.20;
      const delay = TOTAL - 1.30 + lateral * -0.25 + depthBoost + Math.random() * 0.20;
      const radius = depth >= 3 ? 2.6 : depth === 2 ? 2.4 : 2.2;
      const node = document.createElementNS(SVG_NS, 'circle');
      node.setAttribute('cx', ox + c * CELL);
      node.setAttribute('cy', oy + r * CELL);
      node.setAttribute('r', radius);
      node.style.setProperty('--delay', Math.max(0, delay) + 's');
      leavesG.appendChild(node);
    });

    mounted = true;
  }

  function ensureMounted() { if (!mounted) render(); }
  ensureMounted();

  // Re-render on resize only if the section hasn't started growing yet —
  // once the animation begins, freeze geometry so we don't snap mid-grow.
  let started = false;
  let resizeTimer;
  window.addEventListener('resize', () => {
    if (started) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && !started) {
        started = true;
        ensureMounted();
        // Next frame so the dasharray styles are committed before the class flip.
        requestAnimationFrame(() => svg.classList.add('is-growing'));
        io.disconnect();
      }
    });
  }, { threshold: 0.25 });
  io.observe(cta);
})();
