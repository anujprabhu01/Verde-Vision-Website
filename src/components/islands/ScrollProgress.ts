// ── Scroll progress bar ──
const progressEl = document.querySelector('.scroll-progress') as HTMLElement | null;
if (progressEl) {
  let ticking = false;
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progressEl.style.setProperty('--scroll-progress', pct.toFixed(4));
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { window.requestAnimationFrame(updateProgress); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();
}

// ── Section reveals ──
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealTargets = document.querySelectorAll<HTMLElement>('[data-reveal-section]');

if (reduceMotion) {
  revealTargets.forEach(el => el.classList.add('is-revealed'));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );
  revealTargets.forEach(el => revealObserver.observe(el));
}

// ── Active nav link ──
const sections = document.querySelectorAll<HTMLElement>('section[id]');
const navLinks = document.querySelectorAll<HTMLAnchorElement>('nav a.nav-link');
const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);
sections.forEach(s => navObserver.observe(s));
