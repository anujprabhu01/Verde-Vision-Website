// ── Hero halo breath ──
// A tight green halo wraps the AVP silhouette and slow-breathes. Dots
// closest to the headset rim are the brightest; intensity fades outward
// only. The halo lights the underlying grid dots; its center anchors to
// the headset's bounding rect, recomputed each frame so it tracks scroll.

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // do nothing — canvas stays invisible
} else {
  const canvas = document.querySelector('.grid-lines') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('.grid-lines canvas not found');

  const headsetEl = document.querySelector('.headset-core') as HTMLElement | null;
  if (!headsetEl) throw new Error('.headset-core not found');

  const ctx = canvas.getContext('2d')!;
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
    canvas!.width = Math.floor(viewW * dpr);
    canvas!.height = Math.floor(viewH * dpr);
    canvas!.style.width = viewW + 'px';
    canvas!.style.height = viewH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor((viewW - DOT_OFFSET) / TILE);
  }

  function frame(now: number) {
    ctx.clearRect(0, 0, canvas!.width, canvas!.height);

    const rect = headsetEl!.getBoundingClientRect();
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
      let vMask: number;
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
        let halo: number;
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
}
