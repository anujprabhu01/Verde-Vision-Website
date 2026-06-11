const section = document.querySelector('.why') as HTMLElement | null;
const pin = section?.querySelector('.why-pin') as HTMLElement | null;
const lineCore = document.getElementById('why-line-core') as SVGPathElement | null;
const lineGlow = document.getElementById('why-line-glow') as SVGPathElement | null;
const tip = document.getElementById('why-tip') as SVGCircleElement | null;
const stops = Array.from(document.querySelectorAll<HTMLElement>('.why-stop'));
const svgEl = section?.querySelector<SVGSVGElement>('.why-line') ?? null;
const photo = section?.querySelector<HTMLImageElement>('.why-photo') ?? null;

if (!section || !pin || !lineCore || !lineGlow) {
  // bail silently — elements not in DOM
} else {
  const totalLength = lineCore.getTotalLength();
  lineCore.style.strokeDasharray = String(totalLength);
  lineCore.style.strokeDashoffset = String(totalLength);
  lineGlow.style.strokeDasharray = String(totalLength);
  lineGlow.style.strokeDashoffset = String(totalLength);

  // Position each milestone dot exactly onto the SVG path using screen CTM.
  // Stops live inside .why-stage (which is translateX'd), so we measure relative
  // to the SVG's own bounding rect — NOT the pin — or they'd pick up the
  // translateX(4%) offset twice.
  function placeStops() {
    if (!svgEl) return;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return;
    const baseR = svgEl.getBoundingClientRect();
    const pt = svgEl.createSVGPoint();
    stops.forEach((s) => {
      const frac = parseFloat(s.dataset.frac ?? '0');
      const onPath = lineCore!.getPointAtLength(totalLength * frac);
      pt.x = onPath.x;
      pt.y = onPath.y;
      const sp = pt.matrixTransform(ctm);
      s.style.left = (sp.x - baseR.left) + 'px';
      s.style.top  = (sp.y - baseR.top)  + 'px';
    });
  }

  placeStops();
  requestAnimationFrame(placeStops);
  window.addEventListener('resize', placeStops);
  if (photo) photo.addEventListener('load', placeStops);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Show finished line + all milestones immediately, no scroll scrub.
    lineCore.style.strokeDashoffset = '0';
    lineGlow.style.strokeDashoffset = '0';
    pin.style.setProperty('--prog', '1');
    stops.forEach((s) => s.classList.add('on'));
  } else {
    let rafId: number | null = null;

    function update() {
      rafId = null;
      const r = section!.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      let p = total > 0 ? -r.top / total : (r.top < 0 ? 1 : 0);
      p = Math.max(0, Math.min(1, p));

      const off = totalLength * (1 - p);
      lineCore!.style.strokeDashoffset = String(off);
      lineGlow!.style.strokeDashoffset = String(off);
      pin!.style.setProperty('--prog', String(p));

      if (tip) {
        if (p > 0.015 && p < 0.99) {
          const pt = lineCore!.getPointAtLength(totalLength * p);
          tip.setAttribute('cx', String(pt.x));
          tip.setAttribute('cy', String(pt.y));
          tip.style.opacity = '1';
        } else {
          tip.style.opacity = '0';
        }
      }

      stops.forEach((s) => {
        const frac = parseFloat(s.dataset.frac ?? '0');
        s.classList.toggle('on', p >= frac);
      });
    }

    function onScroll() {
      if (rafId === null) rafId = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { placeStops(); update(); }, { passive: true });
    update();
  }
}
