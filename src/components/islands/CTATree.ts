const SVG_NS = 'http://www.w3.org/2000/svg';
const cta = document.querySelector('.cta') as HTMLElement | null;
const svg = document.getElementById('cta-tree') as SVGSVGElement | null;
if (!cta || !svg) throw new Error('CTA tree elements not found');

const dotsG     = svg.querySelector('.cta-tree-dots') as SVGGElement;
const branchesG = svg.querySelector('.cta-tree-branches') as SVGGElement;
const leavesG   = svg.querySelector('.cta-tree-leaves') as SVGGElement;

// Seeded PRNG so the silhouette is consistent run-to-run.
function makeRand(seed: number) {
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
function buildOak(cols: number, rows: number) {
  const rand = makeRand(0xC0FFEE);
  const cx = Math.floor(cols / 2);
  const trunkBase = rows - 1;
  const trunkTop = Math.max(3, rows - Math.max(5, Math.floor(rows * 0.26)));
  const droopFloor = Math.min(rows - 2, trunkTop + Math.max(2, Math.floor(rows * 0.10)));

  const branches: { points: number[][], depth: number }[] = [];
  const tips: { x: number, y: number, depth: number }[] = [];

  // Trunk
  const trunk: number[][] = [];
  for (let y = trunkBase; y >= trunkTop; y--) trunk.push([cx, y]);
  branches.push({ points: trunk, depth: 0 });

  function inBounds(x: number, y: number) { return x >= 1 && x <= cols - 2 && y >= 1 && y <= droopFloor; }

  // Walk a branch outward, possibly upward and (later) drooping back down,
  // possibly forking. dirBias in roughly [-1.6, 1.6]; positive = right.
  function walk(x: number, y: number, dirBias: number, life: number, depth: number) {
    const pts: number[][] = [[x, y]];
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
function buildLeafCluster(
  tip: { x: number, y: number, depth: number },
  depth: number,
  occupied: Set<string>,
  cols: number,
  rows: number,
  rand: () => number
) {
  const radius = depth >= 3 ? 4 : depth === 2 ? 3 : 2;
  const target = depth >= 3 ? 7 + Math.floor(rand() * 4)
                : depth === 2 ? 5 + Math.floor(rand() * 3)
                : 3 + Math.floor(rand() * 2);
  const cells: number[][] = [];
  const seen = new Set<string>();
  const tryAdd = (x: number, y: number) => {
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
function offsetPair(pointsPx: number[][], w: number) {
  if (w < 1.2 || pointsPx.length < 2) return { single: pointsPx };
  const left: number[][] = [], right: number[][] = [];
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
      tx = p[0] - prev![0]; ty = p[1] - prev![1];
    }
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl, ny = tx / tl;
    left.push([p[0] + nx * w / 2, p[1] + ny * w / 2]);
    right.push([p[0] - nx * w / 2, p[1] - ny * w / 2]);
  }
  return { left, right };
}

function pathD(pts: number[][]) {
  let s = '';
  for (let i = 0; i < pts.length; i++) {
    s += (i === 0 ? 'M ' : ' L ') + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
  }
  return s;
}

function pathLength(pts: number[][]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) {
    l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return l;
}

let mounted = false;
function render() {
  const rect = cta!.getBoundingClientRect();
  const W = Math.max(320, Math.round(rect.width));
  const H = Math.max(240, Math.round(rect.height));
  // Denser grid than the body's 28px dots — gives the canopy more resolution.
  const CELL = 22;
  const COLS = Math.max(14, Math.floor(W / CELL));
  const ROWS = Math.max(10, Math.floor(H / CELL));
  const ox = (W - (COLS - 1) * CELL) / 2;
  const oy = H - (ROWS - 1) * CELL - 10;

  svg!.setAttribute('viewBox', `0 0 ${W} ${H}`);

  dotsG.replaceChildren();
  branchesG.replaceChildren();
  leavesG.replaceChildren();

  const rand = makeRand(0xC0FFEE ^ 0xA17);
  const spec = buildOak(COLS, ROWS);

  // Build leaf clusters around each tip. Track occupied cells so neighbouring
  // tips don't overlap their clusters into mush.
  const occupied = new Set<string>();
  const leafCells: { c: number, r: number, depth: number }[] = [];
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
      c.setAttribute('cx', String(ox + cxg * CELL));
      c.setAttribute('cy', String(oy + cy * CELL));
      c.setAttribute('r', '1.0');
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
    const sides = (pair as any).single ? [(pair as any).single] : [(pair as any).left, (pair as any).right];
    const delay = isTrunk ? 0 : depthDelay[depthIdx] + Math.random() * 0.22;
    const dur   = isTrunk ? depthDur[0] : depthDur[depthIdx];

    sides.forEach((side: number[][]) => {
      const d = pathD(side);
      const len = pathLength(side);
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.style.setProperty('--len', String(len));
      path.style.setProperty('--delay', delay + 's');
      path.style.setProperty('--dur', dur + 's');
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);
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
    node.setAttribute('cx', String(ox + c * CELL));
    node.setAttribute('cy', String(oy + r * CELL));
    node.setAttribute('r', String(radius));
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
let resizeTimer: ReturnType<typeof setTimeout>;
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
      requestAnimationFrame(() => svg!.classList.add('is-growing'));
      io.disconnect();
    }
  });
}, { threshold: 0.25 });
io.observe(cta!);
