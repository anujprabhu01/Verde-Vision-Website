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


// ── Demo video mute toggle ──
const muteBtn = document.getElementById('demo-video-mute');
const demoVideo = document.getElementById('demo-video');
if (muteBtn && demoVideo) {
  muteBtn.addEventListener('click', () => {
    demoVideo.muted = !demoVideo.muted;
    muteBtn.classList.toggle('is-unmuted', !demoVideo.muted);
    muteBtn.setAttribute('aria-label', demoVideo.muted ? 'Unmute video' : 'Mute video');
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
