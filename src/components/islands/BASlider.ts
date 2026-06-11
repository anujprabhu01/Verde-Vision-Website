const slider = document.getElementById('ba-slider') as HTMLElement | null;
if (!slider) throw new Error('ba-slider not found');

const baBtnBefore = document.getElementById('ba-btn-before') as HTMLElement | null;
const baBtnAfter  = document.getElementById('ba-btn-after')  as HTMLElement | null;

let dragging = false;
let autoplayRaf: number | null = null;
let userInteracted = false;
let autoplaying = true;
let snapRaf: number | null = null;

function setPct(pct: number) {
  pct = Math.max(0, Math.min(100, pct));
  document.documentElement.style.setProperty('--ba-pct', String(pct));
  if (!autoplaying) {
    document.querySelectorAll('.ba-label-before').forEach(
      (el) => el.classList.toggle('is-active', pct >= 99)
    );
    document.querySelectorAll('.ba-label-after').forEach(
      (el) => el.classList.toggle('is-active', pct <= 1)
    );
  }
}

function setPosition(clientX: number) {
  const rect = slider.getBoundingClientRect();
  setPct(((clientX - rect.left) / rect.width) * 100);
}

setPct(100);

function cancelSnap() {
  if (snapRaf !== null) { cancelAnimationFrame(snapRaf); snapRaf = null; }
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function snapTo(targetPct: number, duration?: number) {
  cancelAutoplay();
  cancelSnap();
  const from = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--ba-pct')
  ) || 50;
  if (duration === undefined) {
    duration = Math.max(180, Math.min(500, Math.abs(targetPct - from) * 5));
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / (duration as number));
    setPct(from + (targetPct - from) * easeInOutCubic(t));
    if (t < 1) snapRaf = requestAnimationFrame(step);
    else snapRaf = null;
  };
  snapRaf = requestAnimationFrame(step);
}

function cancelAutoplay() {
  userInteracted = true;
  if (autoplayRaf !== null) {
    cancelAnimationFrame(autoplayRaf);
    autoplayRaf = null;
  }
}

function animatePhase(
  from: number, to: number, duration: number,
  ease: (t: number) => number
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAutoplay() {
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

// ── Before/After pill buttons (snap to either extreme) ──
// stopPropagation prevents the click from bubbling into the slider's pointerdown.
const stopProp = (e: Event) => e.stopPropagation();
[baBtnBefore, baBtnAfter].forEach((btn) => {
  if (!btn) return;
  btn.addEventListener('pointerdown', stopProp);
});
baBtnBefore?.addEventListener('click', (e) => { stopProp(e); snapTo(100); });
baBtnAfter?.addEventListener('click',  (e) => { stopProp(e); snapTo(0);   });

// ── Pointer Events (replaces separate mousedown/touchstart/mousemove/touchmove/mouseup/touchend) ──
slider.addEventListener('pointerdown', (e) => {
  dragging = true;
  slider.setPointerCapture(e.pointerId);
  slider.classList.add('is-grabbing');
  cancelAutoplay();
  // Smooth glide to the click/tap position; if the user drags, pointermove
  // cancels this snap and switches to direct tracking (matches original behavior).
  snapTo(((e.clientX - slider.getBoundingClientRect().left) / slider.getBoundingClientRect().width) * 100);
  e.preventDefault();
});

slider.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  cancelSnap();
  setPosition(e.clientX);
});

slider.addEventListener('pointerup', () => {
  dragging = false;
  slider.classList.remove('is-grabbing');
});

slider.addEventListener('pointercancel', () => {
  dragging = false;
  slider.classList.remove('is-grabbing');
});

// ── Autoplay on first enter ──
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMotion) {
  autoplaying = false;
  setPct(50);
} else {
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !userInteracted) {
        o.disconnect();
        setTimeout(() => { if (!userInteracted) runAutoplay(); }, 250);
      }
    });
  }, { threshold: 0.4 });
  obs.observe(slider);
}
