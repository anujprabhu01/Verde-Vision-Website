# Astro Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the VerdeVision marketing site from a plain HTML/CSS/JS monolith to Astro, eliminating ~20MB of unoptimized images, deferred JS loading, scoped CSS, and cross-device interaction bugs.

**Architecture:** Single Astro page (`src/pages/index.astro`) assembles ~8 `.astro` components. Interactive sections (B/A slider, scroll path, video controls, booking widget, CTA tree, canvas grid) become isolated TypeScript island scripts loaded with `client:load`, `client:visible`, or `client:idle` directives. CSS variables/tokens are global; all other styles are scoped per-component.

**Tech Stack:** Astro 5, TypeScript, `@astrojs/vercel` (static adapter), `astro:assets` Image, `@fontsource-variable/inter`, `@fontsource/fraunces`, `@fontsource/geist-mono`, PostCSS + Autoprefixer.

**Reference files:** `index.html` (HTML structure), `styles.css` (CSS — port sections by the `/* ── SECTION ── */` comment markers), `main.js` (JS — port functions verbatim unless noted)

---

## File Map

**Create:**
- `astro.config.mjs` — Astro config with Vercel adapter + image service
- `package.json` — dependencies
- `tsconfig.json` — TypeScript config (Astro generates this)
- `.postcssrc.mjs` — Autoprefixer config
- `src/styles/global.css` — CSS variables/tokens only (~2KB)
- `src/layouts/Layout.astro` — base HTML shell, `<head>`, meta, fonts
- `src/pages/index.astro` — assembles all components
- `src/components/Nav.astro` — fixed nav + inline mobile toggle script
- `src/components/Hero.astro` — static hero shell, mounts BASlider island
- `src/components/WhyItWins.astro` — static Why It Wins shell, mounts ScrollPath island
- `src/components/Features.astro` — feature grid with Astro `<Image>` for all 5 cards
- `src/components/InAction.astro` — video section shell, mounts VideoControls island
- `src/components/Booking.astro` — booking section shell, mounts BookingWidget island
- `src/components/CTA.astro` — CTA section shell, mounts CTATree island
- `src/components/Footer.astro` — static footer
- `src/components/islands/BASlider.ts` — B/A slider rewritten with Pointer Events API
- `src/components/islands/ScrollPath.ts` — Why It Wins scroll animation (rAF + cached measurements)
- `src/components/islands/VideoControls.ts` — video mute/restart/scrubber (ported from main.js)
- `src/components/islands/BookingWidget.ts` — calendar + time slots + Formspree form
- `src/components/islands/CTATree.ts` — oak tree SVG animation (ported from main.js)
- `src/components/islands/CanvasGrid.ts` — hero halo canvas animation (ported from main.js)
- `src/components/islands/ScrollProgress.ts` — scroll progress bar + reveals + nav spy + feature card spotlight

**Move to `src/assets/`** (Astro optimizes these at build time):
- `feature-01-design.png` → `src/assets/feature-01-design.png`
- `feature-02-blueprint.png` → `src/assets/feature-02-blueprint.png`
- `feature-03-estimate.png` → `src/assets/feature-03-estimate.png`
- `feature-04-persist.png` → `src/assets/feature-04-persist.png`
- `feature-05-crew.png` → `src/assets/feature-05-crew.png`
- `HeadsetTransparent.png` → `src/assets/HeadsetTransparent.png`
- `sunset-mountain.webp` → `src/assets/sunset-mountain.webp`
- `Before.png` → `src/assets/Before.png`
- `After.png` → `src/assets/After.png`

**Stay in `public/`** (referenced directly by URL, not optimized):
- `verde_vision_logo.png` — favicon
- `fonts/DepartureMono-Regular.woff2` — local font

**Delete after migration is verified:**
- `index.html`
- `styles.css`
- `main.js`

---

## Task 1: Create branch + scaffold Astro project

**Files:**
- Create: `astro.config.mjs`, `package.json`, `tsconfig.json`, `.postcssrc.mjs`

- [ ] **Step 1: Create the migration branch**

```bash
git checkout -b astro-migration
```

- [ ] **Step 2: Scaffold the Astro project**

Run from the repo root. When prompted: choose "Empty" template, "Yes" to TypeScript, "Strict" tsconfig, "Yes" to install dependencies.

```bash
npm create astro@latest . -- --template empty --typescript strict --install --no-git
```

Expected: `astro.config.mjs`, `package.json`, `tsconfig.json`, `src/` created.

- [ ] **Step 3: Install dependencies**

```bash
npm install @astrojs/vercel @fontsource-variable/inter @fontsource/fraunces @fontsource/geist-mono
npm install -D sharp autoprefixer postcss
```

- [ ] **Step 4: Write `astro.config.mjs`**

```javascript
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/static';

export default defineConfig({
  output: 'static',
  adapter: vercel(),
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
});
```

- [ ] **Step 5: Write `.postcssrc.mjs`**

```javascript
export default {
  plugins: {
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create `src/` directory structure**

```bash
mkdir -p src/layouts src/components/islands src/assets src/styles src/pages
```

- [ ] **Step 7: Move images to `src/assets/`**

```bash
mv feature-01-design.png feature-02-blueprint.png feature-03-estimate.png feature-04-persist.png feature-05-crew.png HeadsetTransparent.png sunset-mountain.webp Before.png After.png src/assets/
```

- [ ] **Step 8: Verify the scaffold builds**

```bash
npm run build
```

Expected: `dist/` created with no errors. (The page will be empty — that's fine at this stage.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Astro project with Vercel adapter + dependencies"
```

---

## Task 2: Global styles + Layout.astro

**Files:**
- Create: `src/styles/global.css`
- Create: `src/layouts/Layout.astro`

- [ ] **Step 1: Write `src/styles/global.css`**

Port only the CSS variables, resets, and body-level rules from `styles.css` lines 1–68. These are shared tokens used by every component.

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@font-face {
  font-family: 'Departure Mono';
  src: url('/fonts/DepartureMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

:root {
  --green-dark:   #0a0a0a;
  --green-mid:    #111111;
  --green-card:   rgba(255,255,255,0.04);
  --green-border: #1e1e1e;
  --accent:       #1fc490;
  --accent-bright:#7dffcf;
  --accent-dim:   #19a578;
  --accent-soft:  rgba(31,196,144,0.32);
  --text:         #d4d4d4;
  --text-muted:   #8e8e8e;
  --text-faint:   #5e5e5e;
  --white:        #ffffff;
  --rule:         rgba(255,255,255,0.08);
  --rule-strong:  rgba(255,255,255,0.14);
  --gold:         #c9a84c;
  --gold-soft:    rgba(201,168,76,0.42);
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-serif:   'Fraunces', 'Iowan Old Style', 'Apple Garamond', Georgia, serif;
  --font-body:    'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono:    'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}

html {
  scroll-behavior: smooth;
  scrollbar-gutter: stable;
}

body {
  background-color: var(--green-dark);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.6;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  opacity: 0.07;
  mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  background-size: 220px 220px;
}

/* Shared section patterns */
.section-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1rem;
}

h2 {
  font-family: var(--font-serif);
  font-size: clamp(2rem, 4.5vw, 3.2rem);
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--white);
  margin-bottom: 1.2rem;
}

h2 em {
  font-style: italic;
  color: var(--accent);
}

.section-intro {
  font-size: clamp(1rem, 1.5vw, 1.1rem);
  color: var(--text-muted);
  max-width: 560px;
  line-height: 1.7;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 5vw;
}

/* Reveal animation system — driven by ScrollProgress island */
[data-reveal-section] .reveal {
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 0.55s ease-out, transform 0.55s ease-out;
}
[data-reveal-section] .reveal-2 { transition-delay: 0.08s; }
[data-reveal-section] .reveal-3 { transition-delay: 0.16s; }
[data-reveal-section] .reveal-4 { transition-delay: 0.24s; }
[data-reveal-section].is-revealed .reveal {
  opacity: 1;
  transform: translateY(0);
}

/* Scroll progress bar — driven by ScrollProgress island */
.scroll-progress {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  z-index: 200;
  pointer-events: none;
  background: rgba(255,255,255,0.04);
}
.scroll-progress::after {
  content: "";
  display: block;
  height: 100%;
  width: calc(var(--scroll-progress, 0) * 100%);
  background: var(--accent);
  box-shadow: 0 0 10px rgba(31,196,144,0.45);
}

/* Canvas grid overlay */
.grid-lines {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

@media (prefers-reduced-motion: reduce) {
  [data-reveal-section] .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

/* Shared button styles */
.btn-primary {
  background: var(--accent);
  color: #0a0a0a;
  padding: 0.85rem 2.2rem;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  text-decoration: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
  box-shadow: 0 0 32px rgba(31,196,144,0.25);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.btn-primary:hover {
  background: #2ee08a;
  transform: translateY(-2px);
  box-shadow: 0 0 48px rgba(31,196,144,0.4);
}
.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-secondary {
  border: 1px solid var(--green-border);
  color: var(--text);
  padding: 0.85rem 2.2rem;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  background: rgba(255,255,255,0.04);
  transition: background 0.2s, border-color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.btn-secondary:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.3);
}
.btn-secondary svg { width: 14px; height: 14px; }
```

- [ ] **Step 2: Write `src/layouts/Layout.astro`**

```astro
---
import '@fontsource-variable/inter';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '../styles/global.css';

interface Props {
  title?: string;
  description?: string;
}

const {
  title = 'VerdeVision — See the yard before you build it',
  description = 'VerdeVision is a spatial landscape design app for Apple Vision Pro. Drop life-size virtual plants into your real yard, walk around them, and price the design — all before breaking ground.',
} = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta name="theme-color" content="#0a0a0a" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content="/After.png" />
    <meta property="og:site_name" content="VerdeVision" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content="/After.png" />
    <link rel="icon" type="image/png" href="/verde_vision_logo.png" />
    <link rel="apple-touch-icon" href="/verde_vision_logo.png" />
  </head>
  <body>
    <slot />
  </body>
</html>
```

Note: `After.png` stays in `public/` for OG/Twitter meta images (served by URL, not through Astro's image pipeline).

- [ ] **Step 3: Build and confirm no errors**

```bash
npm run build
```

Expected: succeeds. Font packages will output CSS; that's normal.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add global styles, CSS tokens, and Layout.astro"
```

---

## Task 3: Nav.astro + Footer.astro + index.astro shell

**Files:**
- Create: `src/components/Nav.astro`
- Create: `src/components/Footer.astro`
- Create: `src/pages/index.astro`

- [ ] **Step 1: Write `src/components/Nav.astro`**

Port markup from `index.html` lines 40–55. Port CSS from `styles.css` under the `/* ── NAV ── */` marker (lines 99–217). The nav toggle JS lives in an inline `<script>` — it's too small for a separate island file.

```astro
---
---
<nav>
  <a href="#" class="nav-logo">
    <img src="/verde_vision_logo.png" alt="" class="nav-logo-img" />
    <span class="nav-logo-text">VERDE VISION</span>
  </a>
  <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">
    <span class="nav-toggle-bar"></span>
    <span class="nav-toggle-bar"></span>
    <span class="nav-toggle-bar"></span>
  </button>
  <div class="nav-links" id="nav-links">
    <a href="#why" class="nav-link">Why It Wins</a>
    <a href="#features" class="nav-link">Features</a>
    <a href="#booking" class="nav-cta">Book a Demo</a>
  </div>
</nav>

<script>
  const nav = document.querySelector('nav')!;
  const toggle = document.querySelector('.nav-toggle')!;
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
</script>

<style>
  /* Port all CSS under the /* ── NAV ── */ marker from styles.css (lines 99–217).
     Paste it here verbatim — Astro scopes it automatically. */
  nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.1rem 5vw;
    background: rgba(10,10,10,0.7);
    backdrop-filter: blur(18px);
    border-bottom: 1px solid var(--green-border);
  }
  /* ... paste remaining nav CSS from styles.css lines 110–217 here ... */
</style>
```

- [ ] **Step 2: Write `src/components/Footer.astro`**

Port markup from `index.html` lines 445–472. Port CSS from `styles.css` under the `/* ── FOOTER ── */` marker.

```astro
---
---
<footer>
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="footer-logo">Verde<span>Vision</span></div>
      <p class="footer-tagline">Spatial landscape design for Apple Vision Pro. Designed in California.</p>
    </div>
    <div class="footer-col">
      <p class="footer-col-title">Product</p>
      <ul>
        <li><a href="#features">Features</a></li>
        <li><a href="#in-action">See it in action</a></li>
        <li><a href="#why">Why Vision Pro</a></li>
        <li><a href="#booking">Book a demo</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <p class="footer-col-title">Contact</p>
      <ul>
        <li><a href="mailto:demos@useverdevision.com">Email us</a></li>
        <li><a href="#booking">Schedule a call</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span class="footer-meta">Built for Apple Vision Pro</span>
    <span>&copy; 2026 VerdeVision. All rights reserved.</span>
  </div>
</footer>

<style>
  /* Port all CSS under the /* ── FOOTER ── */ marker from styles.css */
</style>
```

- [ ] **Step 3: Write `src/pages/index.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
---
<Layout>
  <div class="scroll-progress" aria-hidden="true"></div>
  <canvas class="grid-lines" aria-hidden="true"></canvas>
  <Nav />
  <Footer />
</Layout>
```

- [ ] **Step 4: Run dev server and verify nav + footer render**

```bash
npm run dev
```

Open `http://localhost:4321`. Expected: nav bar fixed at top, footer at bottom, dark background, tokens applied.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Nav, Footer, and index.astro shell"
```

---

## Task 4: Hero.astro (static shell)

**Files:**
- Create: `src/components/Hero.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write `src/components/Hero.astro`**

Port markup from `index.html` lines 57–161. Port CSS from the `/* ── HERO ── */` and `/* ── Vision Pro headset ── */` marker sections in `styles.css`. Replace `100vh` with `100dvh` (add `100vh` fallback).

```astro
---
import { Image } from 'astro:assets';
import headsetImg from '../assets/HeadsetTransparent.png';
import beforeImg from '../assets/Before.png';
import afterImg from '../assets/After.png';
---
<section class="hero">
  <div class="hero-grid">
    <div class="hero-content">
      <div class="hero-eyebrow hero-anim hero-anim-1">Spatial Landscape Design</div>
      <h1>
        <span class="hero-line hero-anim hero-anim-2">See the yard</span><br/>
        <span class="accent hero-line hero-anim hero-anim-3">before you build it.</span>
      </h1>
      <p class="hero-anim hero-anim-4">
        Design, visualize, and price outdoor spaces in real time with AR —
        all before breaking ground.
      </p>
      <div class="hero-actions hero-anim hero-anim-5">
        <a href="#booking" class="btn-primary">Book a Demo &rarr;</a>
        <a href="#in-action" class="btn-secondary">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          Watch It in Action
        </a>
      </div>
    </div>

    <div class="hero-visual">
      <svg class="lens-clip-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <clipPath id="lens-clip" clipPathUnits="objectBoundingBox">
            <path d="M 0.06,0.28 C 0.08,0.14 0.18,0.06 0.32,0.07 C 0.42,0.08 0.58,0.08 0.68,0.07 C 0.82,0.06 0.92,0.14 0.94,0.28 C 0.98,0.55 0.95,0.80 0.86,0.94 C 0.78,1.00 0.66,0.98 0.59,0.88 C 0.55,0.82 0.50,0.80 0.45,0.82 C 0.41,0.84 0.41,0.86 0.41,0.88 C 0.34,0.98 0.22,1.00 0.14,0.94 C 0.05,0.80 0.02,0.55 0.06,0.28 Z" />
          </clipPath>
          <filter id="lens-feather" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.025" />
          </filter>
          <mask id="lens-mask" maskContentUnits="objectBoundingBox">
            <path d="M 0.10,0.32 C 0.12,0.18 0.22,0.12 0.34,0.13 C 0.42,0.14 0.58,0.14 0.66,0.13 C 0.78,0.12 0.88,0.18 0.90,0.32 C 0.94,0.55 0.91,0.74 0.84,0.86 C 0.76,0.92 0.66,0.90 0.59,0.84 C 0.55,0.80 0.50,0.78 0.45,0.80 C 0.41,0.82 0.41,0.84 0.41,0.84 C 0.34,0.90 0.24,0.92 0.16,0.86 C 0.09,0.74 0.06,0.55 0.10,0.32 Z"
                 fill="white" filter="url(#lens-feather)" />
          </mask>
        </defs>
      </svg>

      <div class="headset">
        <div class="headset-core">
          <div class="ba-slider" id="ba-slider">
            <div class="ba-stage">
              <div class="ba-img ba-after">
                <Image src={afterImg} alt="After landscape design" />
              </div>
              <div class="ba-img ba-before" id="ba-before">
                <Image src={beforeImg} alt="Before landscape design" />
              </div>
            </div>
            <div class="ba-handle" id="ba-handle">
              <div class="ba-handle-knob">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 3 12 9 6"/><polyline points="15 18 21 12 15 6"/></svg>
              </div>
            </div>
          </div>
          <Image class="headset-img" src={headsetImg} alt="Apple Vision Pro" />
        </div>

        <div class="headset-reflection-core" aria-hidden="true">
          <div class="ba-slider ba-slider-mirror">
            <div class="ba-stage">
              <div class="ba-img ba-after">
                <Image src={afterImg} alt="" />
              </div>
              <div class="ba-img ba-before">
                <Image src={beforeImg} alt="" />
              </div>
            </div>
            <div class="ba-handle">
              <div class="ba-handle-knob">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 3 12 9 6"/><polyline points="15 18 21 12 15 6"/></svg>
              </div>
            </div>
          </div>
          <Image class="headset-img" src={headsetImg} alt="" />
        </div>
      </div>
    </div>
  </div>

  <div class="hero-tagline">
    <p class="hero-tagline-text hero-anim hero-anim-5">Designed for landscape pros &mdash; Built to help you win</p>
    <a href="#why" class="hero-scroll" aria-label="Scroll to next section">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </a>
  </div>
</section>

<style>
  .hero {
    min-height: 100vh; /* fallback */
    min-height: 100dvh;
    /* ... port remaining hero CSS from styles.css under /* ── HERO ── */ marker ... */
  }
  /* Port all .hero*, .headset*, .ba-*, .lens-*, .btn-* CSS from styles.css.
     Key sections: lines 219–683 cover hero, headset, slider CSS. */
</style>
```

**Important CSS note:** The `.ba-img` divs used to be empty divs with `background-image` styles. They are now wrappers around `<Image>` components. Add these rules to position the images correctly:

```css
.ba-img {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.ba-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

- [ ] **Step 2: Add Hero to `src/pages/index.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
import Nav from '../components/Nav.astro';
import Hero from '../components/Hero.astro';
import Footer from '../components/Footer.astro';
---
<Layout>
  <div class="scroll-progress" aria-hidden="true"></div>
  <canvas class="grid-lines" aria-hidden="true"></canvas>
  <Nav />
  <Hero />
  <Footer />
</Layout>
```

- [ ] **Step 3: Build to verify image optimization is working**

```bash
npm run build
```

Expected: build succeeds. Check `dist/_astro/` — you should see `.webp` files generated from the PNG assets.

- [ ] **Step 4: Verify visually in dev**

```bash
npm run dev
```

Expected: hero section renders with headset, headline, CTAs. B/A slider images visible (not yet interactive — that's Task 5).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Hero.astro with optimized images"
```

---

## Task 5: BASlider.ts island (Pointer Events rewrite)

**Files:**
- Create: `src/components/islands/BASlider.ts`
- Modify: `src/components/Hero.astro`

- [ ] **Step 1: Write `src/components/islands/BASlider.ts`**

This rewrites the slider from separate `mousedown`/`touchstart`/`touchmove`/`mouseup`/`touchend` handlers to a single unified Pointer Events API. The autoplay logic and `snapTo`/`animatePhase` functions are ported verbatim from `main.js`.

```typescript
const slider = document.getElementById('ba-slider') as HTMLElement | null;
if (!slider) throw new Error('ba-slider not found');

let dragging = false;
let autoplayRaf: number | null = null;
let userInteracted = false;
let autoplaying = true;
let snapRaf: number | null = null;

function setPct(pct: number) {
  pct = Math.max(0, Math.min(100, pct));
  document.documentElement.style.setProperty('--ba-pct', String(pct));
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

// ── Pointer Events (replaces separate mousedown/touchstart/mousemove/touchmove/mouseup/touchend) ──
slider.addEventListener('pointerdown', (e) => {
  dragging = true;
  slider.setPointerCapture(e.pointerId);
  slider.classList.add('is-grabbing');
  cancelAutoplay();
  cancelSnap();
  setPosition(e.clientX);
  e.preventDefault();
});

slider.addEventListener('pointermove', (e) => {
  if (!dragging) return;
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
```

- [ ] **Step 2: Mount the island in `Hero.astro`**

Add at the bottom of `src/components/Hero.astro`, before `</style>` but after the HTML:

```astro
<script>
  import BASlider from './islands/BASlider.ts';
</script>
```

Wait — Astro island scripts are loaded via `<script>` tags, not component directives, for vanilla TS islands. Use this pattern instead:

```astro
<script>
  // BASlider island — runs client-side only
  // Import and execute immediately (equivalent to client:load)
  import('./islands/BASlider.ts');
</script>
```

Place this at the bottom of `Hero.astro` just before the `</style>` block closes. Actually, it goes outside the `<style>` block:

```astro
<!-- at the bottom of Hero.astro, after all HTML -->
<script>
  import('./islands/BASlider.ts');
</script>

<style>
  /* ... styles ... */
</style>
```

- [ ] **Step 3: Verify the slider works in dev**

```bash
npm run dev
```

Open `http://localhost:4321`. Expected: slider autoplay sweep on page load. Drag with mouse — no lag. On mobile emulation in DevTools, touch drag should work identically.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add BASlider island with Pointer Events API"
```

---

## Task 6: WhyItWins.astro + ScrollPath.ts island

**Files:**
- Create: `src/components/WhyItWins.astro`
- Create: `src/components/islands/ScrollPath.ts`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write `src/components/WhyItWins.astro`**

Port markup from `index.html` lines 163–208. Port CSS from the `/* ── WHY ── */` marker section in `styles.css`.

```astro
---
import { Image } from 'astro:assets';
import sunsetImg from '../assets/sunset-mountain.webp';
---
<section class="why" id="why">
  <div class="why-pin">
    <div class="why-stage">
      <Image
        class="why-photo"
        src={sunsetImg}
        alt="A desert estate at dusk, a lit path winding up to the home"
        widths={[800, 1200, 1800]}
        sizes="100vw"
      />
      <div class="why-scene-fade" aria-hidden="true"></div>
      <svg class="why-line" viewBox="0 0 100 56" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="why-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stop-color="#e3a94e" stop-opacity="0.5"/>
            <stop offset="0.55" stop-color="#f1b75e"/>
            <stop offset="1" stop-color="#ffd98a"/>
          </linearGradient>
          <filter id="why-soft" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="0.85"/></filter>
        </defs>
        <path class="why-line-glow" id="why-line-glow" d="M43 45.3 C47.7 43.4 66.3 36.65 71.3 34.1 C76.3 31.55 74.2 31.27 73 30 C71.8 28.73 63.83 27.75 64 26.5 C64.17 25.25 74.75 23.83 74 22.5 C73.25 21.17 61.42 19.5 59.5 18.5 C57.58 17.5 62 16.83 62.5 16.5"></path>
        <path class="why-line-core" id="why-line-core" d="M43 45.3 C47.7 43.4 66.3 36.65 71.3 34.1 C76.3 31.55 74.2 31.27 73 30 C71.8 28.73 63.83 27.75 64 26.5 C64.17 25.25 74.75 23.83 74 22.5 C73.25 21.17 61.42 19.5 59.5 18.5 C57.58 17.5 62 16.83 62.5 16.5"></path>
        <circle class="why-tip" id="why-tip" r="0.6"></circle>
      </svg>
      <div class="why-stops" id="why-stops">
        <div class="why-stop lbl-right" data-frac="0"><span class="why-dot"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M19 20a5 5 0 0 0-3-4.5"/></svg></span><div class="why-lbl"><b>More confidence</b><i>they see the full vision at true scale</i></div></div>
        <div class="why-stop lbl-right" data-frac="0.446"><span class="why-dot"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></span><div class="why-lbl"><b>Fewer revisions</b><i>clarity up front, less back-and-forth</i></div></div>
        <div class="why-stop" data-frac="0.595"><span class="why-dot"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span><div class="why-lbl"><b>Faster approvals</b><i>they understand it, so they sign sooner</i></div></div>
        <div class="why-stop lbl-right" data-frac="0.746"><span class="why-dot"><svg viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 6.5A4 4 0 0 0 13 4h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2A4 4 0 0 1 7 17"/></svg></span><div class="why-lbl"><b>Bigger projects</b><i>confident clients invest more</i></div></div>
        <div class="why-stop why-stop-last lbl-right" data-frac="1"><span class="why-dot"><svg viewBox="0 0 24 24"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg></span><div class="why-lbl"><b>More revenue</b><i>more deals, higher value, more profit</i></div></div>
      </div>
    </div>

    <div class="why-content">
      <div class="why-rail">
        <div class="section-label" data-chapter="01">Why It Wins</div>
        <h2>Turn <em>&ldquo;let me think about it&rdquo;</em> <br />into <em>&ldquo;let&rsquo;s build&nbsp;it.&rdquo;</em></h2>
        <ol class="why-levers">
          <li class="why-lever"><span class="why-lever-num">01</span><div><h3>Close more</h3><p>Confidence sells. A client who can see the result says yes &mdash; no leap of faith.</p></div></li>
          <li class="why-lever"><span class="why-lever-num">02</span><div><h3>Sell bigger</h3><p>At true scale, the upgrade sells itself.</p></div></li>
          <li class="why-lever"><span class="why-lever-num">03</span><div><h3>Close faster</h3><p>They&rsquo;re approving what they can see, not a drawing.</p></div></li>
        </ol>
      </div>
    </div>
  </div>
</section>

<script>
  // client:visible — only load when the section enters the viewport
  const _obs = new IntersectionObserver((entries, o) => {
    if (entries[0].isIntersecting) {
      o.disconnect();
      import('./islands/ScrollPath.ts');
    }
  }, { threshold: 0.1 });
  _obs.observe(document.querySelector('.why')!);
</script>

<style>
  /* Port all CSS under the /* ── WHY ── */ marker from styles.css */
  .why-photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  /* ... remaining why CSS ... */
</style>
```

- [ ] **Step 2: Write `src/components/islands/ScrollPath.ts`**

Find the scroll path animation code in `main.js`. Search for `why-line-core` — it drives the SVG `stroke-dashoffset` based on scroll position. Port it with cached measurements (read `getBoundingClientRect` once, not on every scroll frame).

```typescript
const section = document.querySelector('.why') as HTMLElement | null;
const lineCore = document.getElementById('why-line-core') as SVGPathElement | null;
const lineGlow = document.getElementById('why-line-glow') as SVGPathElement | null;
const tip = document.getElementById('why-tip') as SVGCircleElement | null;
const stops = document.querySelectorAll<HTMLElement>('.why-stop');

if (!section || !lineCore || !lineGlow || !tip) {
  // Section not present on page — bail silently
} else {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Reveal everything immediately
    const totalLength = lineCore.getTotalLength();
    lineCore.style.strokeDasharray = String(totalLength);
    lineCore.style.strokeDashoffset = '0';
    lineGlow.style.strokeDasharray = String(totalLength);
    lineGlow.style.strokeDashoffset = '0';
    stops.forEach(s => s.classList.add('is-visible'));
  } else {
    let totalLength = 0;
    let sectionTop = 0;
    let sectionHeight = 0;
    let rafId: number | null = null;

    function measure() {
      totalLength = lineCore!.getTotalLength();
      lineCore!.style.strokeDasharray = String(totalLength);
      lineGlow!.style.strokeDasharray = String(totalLength);
      const rect = section!.getBoundingClientRect();
      sectionTop = rect.top + window.scrollY;
      sectionHeight = rect.height;
    }

    function update() {
      rafId = null;
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      // Progress 0→1 as the section scrolls from entering the viewport to leaving it
      const raw = (scrollY + vh - sectionTop) / (sectionHeight + vh);
      const progress = Math.max(0, Math.min(1, raw));
      const offset = totalLength * (1 - progress);
      lineCore!.style.strokeDashoffset = String(offset);
      lineGlow!.style.strokeDashoffset = String(offset);
      // Move tip dot to current end of drawn path
      if (progress > 0 && progress < 1) {
        const pt = lineCore!.getPointAtLength(totalLength * progress);
        tip!.setAttribute('cx', String(pt.x));
        tip!.setAttribute('cy', String(pt.y));
        tip!.style.opacity = '1';
      } else {
        tip!.style.opacity = '0';
      }
      // Show stops as path reaches them
      stops.forEach(stop => {
        const frac = parseFloat(stop.dataset.frac ?? '0');
        stop.classList.toggle('is-visible', progress >= frac);
      });
    }

    function onScroll() {
      if (rafId === null) rafId = requestAnimationFrame(update);
    }

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { measure(); update(); }, { passive: true });
    update();
  }
}
```

- [ ] **Step 3: Add WhyItWins to `src/pages/index.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
import Nav from '../components/Nav.astro';
import Hero from '../components/Hero.astro';
import WhyItWins from '../components/WhyItWins.astro';
import Footer from '../components/Footer.astro';
---
<Layout>
  <div class="scroll-progress" aria-hidden="true"></div>
  <canvas class="grid-lines" aria-hidden="true"></canvas>
  <Nav />
  <Hero />
  <WhyItWins />
  <Footer />
</Layout>
```

- [ ] **Step 4: Verify scroll path in dev**

```bash
npm run dev
```

Scroll down to the Why It Wins section. Expected: gold path animates as you scroll, stop labels appear as path reaches them.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add WhyItWins section with scroll path animation island"
```

---

## Task 7: Features.astro (image optimization)

**Files:**
- Create: `src/components/Features.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write `src/components/Features.astro`**

Port markup from `index.html` lines 211–290. Use Astro `<Image>` for all 5 feature images — this is where most of the 20MB → 600KB gain happens. The current feature cards use CSS background images; switch to `<Image>` positioned absolutely with `object-fit: cover`.

```astro
---
import { Image } from 'astro:assets';
import feat01 from '../assets/feature-01-design.png';
import feat02 from '../assets/feature-02-blueprint.png';
import feat03 from '../assets/feature-03-estimate.png';
import feat04 from '../assets/feature-04-persist.png';
import feat05 from '../assets/feature-05-crew.png';

const features = [
  { src: feat01, alt: 'Design in real space', index: '01 / 05', title: 'Design in <em>Real</em> Space', desc: 'Drop life-size 3D plants into the real yard. Walk around them at true mature scale — before you buy a thing.', hero: true },
  { src: feat02, alt: 'Permit-ready blueprints', index: '02 / 05', title: 'Permit-Ready Blueprints', desc: 'One tap, one scaled PDF — plant symbols, dimensions, and a full plant schedule. No CAD required.', hero: false },
  { src: feat03, alt: 'Quote on the spot', index: '03 / 05', title: 'Quote on the Spot', desc: 'Itemized PDF estimates with plant pricing and labor — generated while you\'re still in the yard.', hero: false },
  { src: feat04, alt: 'Pick up on any visit', index: '04 / 05', title: 'Pick Up On Any Visit', desc: 'Real-world anchors lock the design to the property. Return weeks later — everything snaps back into place.', hero: false },
  { src: feat05, alt: 'Guide your crew', index: '05 / 05', title: 'Guide Your Crew', desc: 'Hand off the headset. Your install crew sees exactly where every plant goes.', hero: false },
];
---
<section class="features" id="features" data-reveal-section>
  <div class="container">
    <div class="features-header">
      <div class="features-header-lede">
        <div class="section-label reveal" data-chapter="02">What VerdeVision Does</div>
        <h2 class="reveal reveal-2">Everything you need to<br class="head-break" /> design with <em>confidence</em>.</h2>
      </div>
      <div class="features-header-desc reveal reveal-3">
        <p class="section-intro">
          A spatial landscape design app for Apple Vision Pro. Walk the property, drop life-size plants,
          and hand off install-ready plans — all before you break ground.
        </p>
      </div>
    </div>

    <div class="features-grid reveal reveal-4">
      {features.map((f, i) => (
        <article class={`feature-card${f.hero ? ' feature-card-hero' : ''}`} data-feature={String(i + 1).padStart(2, '0')}>
          <div class="feature-image-wrapper">
            <Image
              src={f.src}
              alt={f.alt}
              class="feature-image"
              widths={[400, 800]}
              sizes="(max-width: 600px) 400px, 800px"
            />
          </div>
          <div class="feature-overlay" aria-hidden="true"></div>
          <div class="feature-body">
            <span class="feature-index">{f.index}</span>
            <h3 set:html={f.title} />
            <p>{f.desc}</p>
          </div>
          <span class="feature-rule" aria-hidden="true"></span>
        </article>
      ))}
    </div>
  </div>
</section>

<script>
  // Feature card cursor glow + mobile scroll spotlight — port from main.js
  // lines 231–315
  document.querySelectorAll<HTMLElement>('.feature-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mx', `${x}%`);
      card.style.setProperty('--my', `${y}%`);
    });
  });

  // Mobile scroll spotlight (port from main.js lines 242–315 verbatim)
  (() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const cards = document.querySelectorAll<HTMLElement>('.feature-card');
    if (!cards.length) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId: number | null = null;
    let attached = false;

    const setActive = (card: HTMLElement | null) => {
      cards.forEach(c => c.classList.toggle('is-active-mobile', c === card));
    };

    const pick = () => {
      const vh = window.innerHeight;
      const viewportCenter = vh / 2;
      const bandTop = vh * 0.15, bandBot = vh * 0.85;
      let best: HTMLElement | null = null, bestDist = Infinity;
      cards.forEach(c => {
        const r = c.getBoundingClientRect();
        if (r.bottom < bandTop || r.top > bandBot) return;
        const dist = Math.abs(r.top + r.height / 2 - viewportCenter);
        if (dist < bestDist) { bestDist = dist; best = c; }
      });
      setActive(best);
      rafId = null;
    };

    const onScroll = () => { if (rafId == null) rafId = requestAnimationFrame(pick); };

    const enable = () => {
      if (attached) return;
      if (reduceMotion) { setActive(cards[0]); return; }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      attached = true; pick();
    };
    const disable = () => {
      if (attached) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        attached = false;
      }
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
      cards.forEach(c => c.classList.remove('is-active-mobile'));
    };

    const sync = () => (mq.matches ? enable() : disable());
    sync();
    mq.addEventListener('change', sync);
  })();
</script>

<style>
  /* Port all CSS under the /* ── FEATURES ── */ marker from styles.css.
     Add these rules for the image switch from background to <img>: */
  .feature-image-wrapper {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .feature-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  /* Remove any .feature-image { background-image } rules ported from styles.css */
</style>
```

- [ ] **Step 2: Add Features to `src/pages/index.astro`**

Insert `<Features />` after `<WhyItWins />` (import it at the top with the others).

- [ ] **Step 3: Build and check image sizes**

```bash
npm run build && du -sh dist/_astro/*.webp 2>/dev/null | sort -h | head -20
```

Expected: feature image WebPs should each be under 100KB.

- [ ] **Step 4: Verify reveal animation triggers in dev**

Scroll down to Features. Expected: heading and cards fade in as the section enters the viewport (once ScrollProgress island is wired in Task 12).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Features section with Astro Image optimization"
```

---

## Task 8: InAction.astro + VideoControls.ts island

**Files:**
- Create: `src/components/InAction.astro`
- Create: `src/components/islands/VideoControls.ts`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write `src/components/InAction.astro`**

Port markup from `index.html` lines 293–358. Port CSS from the `/* ── IN ACTION ── */` marker in `styles.css`. The video scrubber in `main.js` already uses Pointer Events — port it verbatim.

```astro
---
import { Image } from 'astro:assets';
import headsetImg from '../assets/HeadsetTransparent.png';
---
<section class="in-action" id="in-action" data-reveal-section>
  <div class="container">
    <div class="action-header">
      <div class="section-label reveal" data-chapter="03">See It In Action</div>
      <h2 class="reveal reveal-2 action-headline">A real session, in a real <em>yard</em>.</h2>
    </div>
  </div>

  <div class="ia-stage reveal reveal-4">
    <div class="ia-stage-glow" aria-hidden="true"></div>
    <div class="ia-headset">
      <div class="ia-headset-core">
        <Image class="ia-headset-img" src={headsetImg} alt="Apple Vision Pro" />
        <div class="ia-lens-stage">
          <div class="ia-lens-feather">
            <video class="ia-video" id="demo-video" muted autoplay loop playsinline preload="metadata">
              <source src="https://pub-cc7a1d5c152b4c65b070cb253d4e7fb8.r2.dev/DemoRecording_compressed.mp4" type="video/mp4" />
              Your browser doesn't support embedded video.
            </video>
          </div>
          <span class="ia-lens-glare" aria-hidden="true"></span>
        </div>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="ia-bar">
      <div class="ia-meta-l">
        <span class="ia-fig">Fig.&nbsp;02</span>
        <span class="ia-place">Backyard study · Tucson, AZ</span>
      </div>
      <div class="action-progress" id="action-progress" role="slider" aria-label="Seek video" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="action-progress-track" aria-hidden="true"></div>
        <div class="action-progress-bar" id="action-progress-bar"></div>
        <div class="action-progress-knob" id="action-progress-knob" aria-hidden="true"></div>
      </div>
      <div class="ia-meta-r">
        <span class="ia-time">
          <span id="action-runtime">00:00</span><span class="caption-time-sep">/</span><span id="action-duration">--:--</span>
        </span>
        <div class="action-controls-cluster">
          <button class="action-ctl" id="demo-video-restart" aria-label="Restart video" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
          <button class="action-ctl demo-video-mute" id="demo-video-mute" aria-label="Unmute video" type="button">
            <svg class="icon-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            <svg class="icon-unmuted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</section>

<script>
  // client:visible — only load when the video section enters the viewport
  const _obs = new IntersectionObserver((entries, o) => {
    if (entries[0].isIntersecting) {
      o.disconnect();
      import('./islands/VideoControls.ts');
    }
  }, { threshold: 0.1 });
  _obs.observe(document.querySelector('.in-action')!);
</script>

<style>
  /* Port all CSS under /* ── IN ACTION ── */ marker from styles.css */
  .ia-headset-img {
    width: 100%;
    height: auto;
    display: block;
  }
</style>
```

- [ ] **Step 2: Write `src/components/islands/VideoControls.ts`**

Port verbatim from `main.js` lines 318–401 (mute button, restart button, timecode, scrubber). The scrubber already uses Pointer Events — no changes needed.

```typescript
const muteBtn = document.getElementById('demo-video-mute') as HTMLButtonElement | null;
const demoVideo = document.getElementById('demo-video') as HTMLVideoElement | null;
const restartBtn = document.getElementById('demo-video-restart') as HTMLButtonElement | null;
const actionRuntime = document.getElementById('action-runtime');
const actionDuration = document.getElementById('action-duration');
const actionProgress = document.getElementById('action-progress');
const actionProgressBar = document.getElementById('action-progress-bar');
const actionProgressKnob = document.getElementById('action-progress-knob');

const pad2 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const fmtMMSS = (s: number) => {
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
    if (actionProgressBar) (actionProgressBar as HTMLElement).style.width = pct + '%';
    if (actionProgressKnob) (actionProgressKnob as HTMLElement).style.left = pct + '%';
    if (actionProgress) actionProgress.setAttribute('aria-valuenow', String(Math.round(pct)));
  });
}

if (actionProgress && demoVideo) {
  let dragging = false;
  const seek = (clientX: number) => {
    const rect = actionProgress.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (isFinite(demoVideo.duration) && demoVideo.duration > 0) {
      demoVideo.currentTime = pct * demoVideo.duration;
    }
  };
  actionProgress.addEventListener('pointerdown', (e) => {
    dragging = true;
    (actionProgress as HTMLElement).setPointerCapture?.((e as PointerEvent).pointerId);
    seek((e as PointerEvent).clientX);
  });
  actionProgress.addEventListener('pointermove', (e) => {
    if (dragging) seek((e as PointerEvent).clientX);
  });
  const endDrag = (e: Event) => {
    if (!dragging) return;
    dragging = false;
    try { (actionProgress as HTMLElement).releasePointerCapture?.((e as PointerEvent).pointerId); } catch (_) {}
  };
  actionProgress.addEventListener('pointerup', endDrag);
  actionProgress.addEventListener('pointercancel', endDrag);
  actionProgress.addEventListener('keydown', (e) => {
    const d = demoVideo.duration || 0;
    if (!d) return;
    if ((e as KeyboardEvent).key === 'ArrowLeft')  { demoVideo.currentTime = Math.max(0, demoVideo.currentTime - 5); e.preventDefault(); }
    if ((e as KeyboardEvent).key === 'ArrowRight') { demoVideo.currentTime = Math.min(d, demoVideo.currentTime + 5); e.preventDefault(); }
  });
}
```

- [ ] **Step 3: Add InAction to `src/pages/index.astro`**

Insert `<InAction />` after `<Features />`.

- [ ] **Step 4: Verify video and controls in dev**

```bash
npm run dev
```

Scroll to the video section. Expected: video autoplays (muted). Mute/unmute toggles. Restart button works. Scrubber drags correctly on both mouse and touch.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add InAction section and VideoControls island"
```

---

## Task 9: Booking.astro + BookingWidget.ts island

**Files:**
- Create: `src/components/Booking.astro`
- Create: `src/components/islands/BookingWidget.ts`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write `src/components/Booking.astro`**

Port markup from `index.html` lines 361–415. Port CSS from the `/* ── BOOKING ── */` marker in `styles.css`.

```astro
---
---
<section class="booking" id="booking" data-reveal-section>
  <div class="container">
    <div class="section-label reveal" data-chapter="04">Book a Demo</div>
    <h2 class="reveal reveal-2">See VerdeVision in <em>action</em></h2>
    <p class="section-intro reveal reveal-3">Pick a time and we'll walk you through the full spatial experience — live on Apple Vision Pro.</p>

    <div class="booking-card reveal reveal-4" id="booking-card">
      <div class="booking-col">
        <p class="booking-col-label">Select a date</p>
        <div class="calendar">
          <div class="cal-header">
            <button class="cal-nav" id="cal-prev">&#8592;</button>
            <span class="cal-month-label" id="cal-month-label"></span>
            <button class="cal-nav" id="cal-next">&#8594;</button>
          </div>
          <div class="cal-weekdays">
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
          </div>
          <div class="cal-days" id="cal-days"></div>
        </div>
      </div>

      <div class="booking-col" id="times-col">
        <p class="booking-col-label">Select a time <span id="selected-date-label"></span></p>
        <div class="time-slots" id="time-slots">
          <p class="booking-placeholder">Choose a date to see available times.</p>
        </div>
      </div>

      <div class="booking-col" id="form-col">
        <p class="booking-col-label">Your details</p>
        <form class="demo-form" id="demo-form">
          <input type="text" id="form-name" placeholder="Full name" required />
          <input type="email" id="form-email" placeholder="Email address" required />
          <textarea id="form-note" placeholder="Anything you'd like us to know? (optional)" rows="3"></textarea>
          <button type="submit" class="btn-primary" id="confirm-btn" disabled>Confirm Booking</button>
        </form>
      </div>
    </div>

    <div class="booking-confirmation" id="booking-confirmation">
      <div class="confirm-icon">&#10003;</div>
      <h3>You're booked!</h3>
      <p id="confirm-details"></p>
      <p class="confirm-sub">We'll be in touch shortly with everything you need.</p>
    </div>
  </div>
</section>

<script>
  import('./islands/BookingWidget.ts');
</script>

<style>
  /* Port all CSS under the /* ── BOOKING ── */ marker from styles.css */
</style>
```

- [ ] **Step 2: Write `src/components/islands/BookingWidget.ts`**

Port from `main.js` lines 426–581 verbatim. The Formspree URL is already in the original: `https://formspree.io/f/xnjlkzde`.

```typescript
const TIMES = ['9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const FORMSPREE_URL = 'https://formspree.io/f/xnjlkzde';

let currentYear = 0, currentMonth = 0;
let selectedDate: Date | null = null, selectedTime: string | null = null;

const calDays     = document.getElementById('cal-days')!;
const calLabel    = document.getElementById('cal-month-label')!;
const calPrev     = document.getElementById('cal-prev')!;
const calNext     = document.getElementById('cal-next')!;
const timeSlotsEl = document.getElementById('time-slots')!;
const selectedDateLabel = document.getElementById('selected-date-label')!;
const confirmBtn  = document.getElementById('confirm-btn') as HTMLButtonElement;
const demoForm    = document.getElementById('demo-form') as HTMLFormElement;
const bookingCard = document.getElementById('booking-card')!;
const bookingConf = document.getElementById('booking-confirmation')!;
const confirmDetails = document.getElementById('confirm-details')!;

function renderCalendar() {
  calLabel.textContent = `${MONTHS[currentMonth]} ${currentYear}`;
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  calDays.innerHTML = '';
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('button');
    empty.className = 'cal-day empty'; empty.disabled = true;
    calDays.appendChild(empty);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isPast = date < today;
    const btn = document.createElement('button');
    btn.className = 'cal-day'; btn.textContent = String(d);
    btn.disabled = isWeekend || isPast;
    if (selectedDate &&
        selectedDate.getFullYear() === currentYear &&
        selectedDate.getMonth() === currentMonth &&
        selectedDate.getDate() === d) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      selectedDate = new Date(currentYear, currentMonth, d);
      selectedTime = null;
      renderCalendar(); renderTimeSlots(); updateConfirmButton();
    });
    calDays.appendChild(btn);
  }
}

function renderTimeSlots() {
  const label = selectedDate!.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  selectedDateLabel.textContent = `— ${label}`;
  timeSlotsEl.innerHTML = '';
  TIMES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'time-slot'; btn.textContent = t;
    btn.addEventListener('click', () => {
      selectedTime = t;
      timeSlotsEl.querySelectorAll('.time-slot').forEach(b => b.classList.toggle('selected', b.textContent === t));
      updateConfirmButton();
    });
    timeSlotsEl.appendChild(btn);
  });
}

function updateConfirmButton() {
  confirmBtn.disabled = !(selectedDate && selectedTime);
}

demoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name  = (document.getElementById('form-name') as HTMLInputElement).value.trim();
  const email = (document.getElementById('form-email') as HTMLInputElement).value.trim();
  const note  = (document.getElementById('form-note') as HTMLTextAreaElement).value.trim();
  const label = selectedDate!.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  confirmBtn.disabled = true; confirmBtn.textContent = 'Sending…';
  try {
    const res = await fetch(FORMSPREE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, email, requested_date: label, requested_time: selectedTime, note: note || '—', _subject: `Demo request from ${name} — ${label} at ${selectedTime}` }),
    });
    if (!res.ok) throw new Error('submission failed');
    confirmDetails.textContent = `${name}, we've got you down for ${label} at ${selectedTime}.`;
    bookingCard.style.display = 'none';
    bookingConf.classList.add('visible');
  } catch {
    confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm Booking';
    alert('Something went wrong — please try again or email us at demos@useverdevision.com');
  }
});

calPrev.addEventListener('click', () => {
  currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});
calNext.addEventListener('click', () => {
  currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

const now = new Date();
currentYear = now.getFullYear(); currentMonth = now.getMonth();
renderCalendar();
```

- [ ] **Step 3: Add Booking to `src/pages/index.astro`**

Insert `<Booking />` after `<InAction />`.

- [ ] **Step 4: Verify booking widget end-to-end in dev**

```bash
npm run dev
```

Scroll to booking section. Expected: calendar renders current month. Click a weekday — time slots appear. Select a time slot — Confirm button enables. Fill in name + email. Submit — confirmation message appears. (Formspree will receive a live submission on a real browser; test with a real email address.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Booking section and BookingWidget island"
```

---

## Task 10: CTA.astro + CTATree.ts island

**Files:**
- Create: `src/components/CTA.astro`
- Create: `src/components/islands/CTATree.ts`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write `src/components/CTA.astro`**

Port markup from `index.html` lines 418–442. Port CSS from the `/* ── CTA ── */` marker in `styles.css`.

```astro
---
---
<section class="cta" data-reveal-section>
  <span class="cta-corner cta-corner-tl" aria-hidden="true"></span>
  <span class="cta-corner cta-corner-tr" aria-hidden="true"></span>
  <span class="cta-corner cta-corner-bl" aria-hidden="true"></span>
  <span class="cta-corner cta-corner-br" aria-hidden="true"></span>
  <svg class="cta-tree" id="cta-tree" aria-hidden="true" preserveAspectRatio="none">
    <defs>
      <filter id="oakGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g class="cta-tree-dots"></g>
    <g class="cta-tree-branches" filter="url(#oakGlow)"></g>
    <g class="cta-tree-leaves" filter="url(#oakGlow)"></g>
  </svg>
  <div class="container">
    <h2 class="reveal">Your yard won't <em>design</em> itself.</h2>
    <p class="reveal reveal-2">Ready to see your landscape before you build it? Book a live demo and experience VerdeVision on Apple Vision Pro.</p>
    <div class="cta-actions reveal reveal-3">
      <a href="#booking" class="btn-primary">Book a Demo</a>
      <a href="mailto:demos@useverdevision.com" class="btn-secondary">Contact Us</a>
    </div>
  </div>
</section>

<script>
  // client:visible — only load when the CTA section enters the viewport
  const _obs = new IntersectionObserver((entries, o) => {
    if (entries[0].isIntersecting) {
      o.disconnect();
      import('./islands/CTATree.ts');
    }
  }, { threshold: 0.1 });
  _obs.observe(document.querySelector('.cta')!);
</script>

<style>
  /* Port all CSS under the /* ── CTA ── */ marker from styles.css */
</style>
```

- [ ] **Step 2: Write `src/components/islands/CTATree.ts`**

Port from `main.js` lines 742 to end (the `ctaOakTree` IIFE). Remove the outer `(function ctaOakTree() { ... })()` wrapper — just export the code as a module-level script.

```typescript
// Port the entire ctaOakTree IIFE from main.js verbatim (lines 742–end).
// Remove the outer IIFE wrapper. The code runs as a module-level script.
// Begin with:

const SVG_NS = 'http://www.w3.org/2000/svg';
const cta = document.querySelector('.cta') as HTMLElement | null;
const svg = document.getElementById('cta-tree') as SVGSVGElement | null;
if (!cta || !svg) throw new Error('CTA tree elements not found');

// ... paste the rest of the ctaOakTree body verbatim from main.js ...
```

- [ ] **Step 3: Add CTA to `src/pages/index.astro`**

Insert `<CTA />` after `<Booking />`.

- [ ] **Step 4: Verify CTA tree renders in dev**

```bash
npm run dev
```

Scroll to the CTA section. Expected: oak tree SVG grows into view.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add CTA section and CTATree island"
```

---

## Task 11: CanvasGrid.ts island

**Files:**
- Create: `src/components/islands/CanvasGrid.ts`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write `src/components/islands/CanvasGrid.ts`**

Port from `main.js` lines 583–740 (the canvas grid IIFE). Add full `prefers-reduced-motion` bail-out at the top (it's already there, but verify it's the first check). Remove the outer IIFE — run as module-level.

```typescript
// Early bail-outs
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // do nothing — canvas stays invisible
} else {
  const canvas = document.querySelector('.grid-lines') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('.grid-lines canvas not found');

  const headsetEl = document.querySelector('.headset-core') as HTMLElement | null;
  if (!headsetEl) throw new Error('.headset-core not found');

  // ... paste the rest of the canvas grid IIFE body verbatim from main.js ...
}
```

- [ ] **Step 2: Mount canvas island in `src/pages/index.astro` with lazy loading**

The canvas island should load at browser idle time — it's purely decorative. In Astro, for vanilla TS islands in `<script>` tags there's no `client:idle` directive syntax directly; use `requestIdleCallback` as the wrapper:

```astro
<script>
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => import('../components/islands/CanvasGrid.ts'));
  } else {
    setTimeout(() => import('../components/islands/CanvasGrid.ts'), 2000);
  }
</script>
```

Add this script block to `src/pages/index.astro` at the bottom of the `<Layout>` slot.

- [ ] **Step 3: Verify canvas grid in dev**

```bash
npm run dev
```

Expected: green dot halo breathes around the headset after a short idle delay. Canvas respects `prefers-reduced-motion` (test in DevTools: Rendering tab → Emulate CSS media feature `prefers-reduced-motion: reduce` → canvas should stay invisible).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add CanvasGrid island with client:idle loading"
```

---

## Task 12: ScrollProgress.ts island

**Files:**
- Create: `src/components/islands/ScrollProgress.ts`
- Modify: `src/pages/index.astro`

This island consolidates three concerns from `main.js`: scroll progress bar, scroll-triggered section reveals, and active nav link highlighting.

- [ ] **Step 1: Write `src/components/islands/ScrollProgress.ts`**

```typescript
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
```

- [ ] **Step 2: Load ScrollProgress immediately in `src/pages/index.astro`**

Add in the `<Layout>` slot, near the top (after the progress bar and canvas elements):

```astro
<script>
  import('../components/islands/ScrollProgress.ts');
</script>
```

- [ ] **Step 3: Verify reveals and nav in dev**

```bash
npm run dev
```

Expected:
1. Scroll progress bar grows as you scroll down the page.
2. Each `[data-reveal-section]` section fades in as it enters the viewport.
3. Active nav link highlights as you scroll through sections.

- [ ] **Step 4: Full build check**

```bash
npm run build
```

Expected: zero TypeScript errors, zero build warnings about missing assets.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add ScrollProgress island (progress bar, reveals, nav spy)"
```

---

## Task 13: iOS + cross-device audit

**Files:**
- Modify: `src/components/Hero.astro` — fix `100vh` → `100dvh`
- Modify: Any component where `100vh` appears

- [ ] **Step 1: Find all `100vh` references**

```bash
grep -rn "100vh" src/
```

Expected: results in `Hero.astro` and possibly other components.

- [ ] **Step 2: Replace `100vh` with `100dvh` + fallback**

For each occurrence, apply this pattern:

```css
/* Before */
min-height: 100vh;

/* After */
min-height: 100vh;     /* fallback for browsers without dvh support */
min-height: 100dvh;    /* dynamic viewport height — accounts for iOS Safari browser chrome */
```

- [ ] **Step 3: Verify Autoprefixer is running**

```bash
npm run build && grep -r "webkit-backdrop-filter" dist/ | head -5
```

Expected: results showing `-webkit-backdrop-filter` in the built CSS output. If zero results, check `.postcssrc.mjs` is configured correctly.

- [ ] **Step 4: Test on iOS Safari (mobile emulation)**

Open DevTools → Toggle device toolbar → Select "iPhone 14". Navigate to `http://localhost:4321`.

Check:
- [ ] Hero headline and CTAs are fully visible (not obscured by browser chrome)
- [ ] B/A slider responds to touch drag
- [ ] Scroll animations play smoothly
- [ ] Nav hamburger opens/closes

- [ ] **Step 5: Test on Android Chrome emulation**

Select "Pixel 7" in device toolbar.

Check:
- [ ] B/A slider responds to touch drag
- [ ] No JS console errors
- [ ] Video controls work

- [ ] **Step 6: Fix any remaining issues found in Steps 4–5**

Document each fix with a comment explaining the specific browser/device it addresses.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: 100dvh viewport fix and cross-device audit"
```

---

## Task 14: Cleanup + full build + PR

**Files:**
- Delete: `index.html`, `styles.css`, `main.js` (only after verifying the Astro build is complete)
- Modify: `.gitignore`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

```bash
echo ".superpowers/" >> .gitignore
```

- [ ] **Step 2: Run final build and check bundle sizes**

```bash
npm run build
echo "--- JS bundle sizes ---"
find dist/_astro -name "*.js" | xargs wc -c | sort -n
echo "--- Image sizes ---"
find dist/_astro -name "*.webp" -o -name "*.png" | xargs wc -c | sort -n | tail -20
```

Expected:
- No single JS file over 30KB
- No image over 150KB (except HeadsetTransparent.png which can be ~200KB)
- Zero TypeScript/build errors

- [ ] **Step 3: Preview the production build locally**

```bash
npm run preview
```

Open `http://localhost:4321`. Walk through the full page:
- [ ] Hero loads with B/A slider autoplay
- [ ] Why It Wins scroll path animates
- [ ] Feature images are sharp and fast
- [ ] Video plays and controls work
- [ ] Booking calendar works end-to-end
- [ ] CTA tree renders
- [ ] Canvas grid halo breathes

- [ ] **Step 4: Delete the old files**

```bash
rm index.html styles.css main.js
```

- [ ] **Step 5: Final build confirming nothing depends on deleted files**

```bash
npm run build
```

Expected: succeeds with zero errors.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "feat: complete Astro migration — remove legacy HTML/CSS/JS"
git push -u origin astro-migration
```

- [ ] **Step 7: Create PR**

```bash
gh pr create \
  --title "Astro migration: 20MB→600KB images, deferred JS, scoped CSS, Pointer Events" \
  --body "$(cat <<'EOF'
## Summary
- Migrates the site from a plain HTML/CSS/JS monolith to Astro
- Feature images: ~20MB total → ~600KB (auto-converted to WebP by Astro)
- JS: 42KB monolithic → deferred island scripts (most loaded only when scrolled into view)
- CSS: 70KB global → scoped per-component, zero dead code
- Fonts: 3 Google Fonts external requests → 0 (bundled via @fontsource)
- B/A slider rewritten with Pointer Events API (fixes cross-device touch bugs)
- All `100vh` replaced with `100dvh` (fixes iOS Safari viewport bug)
- Autoprefixer runs on every build (fixes missing vendor prefixes)

## Test plan
- [ ] Verify useverdevision.com Vercel preview URL renders correctly
- [ ] Test on iOS Safari (real device or BrowserStack)
- [ ] Test on Android Chrome
- [ ] Run Lighthouse audit on preview URL — Performance should be 90+
- [ ] Test booking form submits to Formspree successfully
- [ ] Confirm no regressions on desktop Chrome/Firefox/Safari

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8: After PR is approved, merge to main**

Vercel will auto-deploy useverdevision.com from `main`. Monitor the Vercel dashboard for successful deployment.

---

## Quick reference: port guide for CSS sections

When porting CSS from `styles.css` to a component's `<style>` block, search by these comment markers:

| Component | Marker in `styles.css` |
|---|---|
| Nav | `/* ── NAV ── */` |
| Hero | `/* ── HERO ── */`, `/* ── Vision Pro headset ── */` |
| WhyItWins | `/* ── WHY ── */` |
| Features | `/* ── FEATURES ── */` |
| InAction | `/* ── IN ACTION ── */` |
| Booking | `/* ── BOOKING ── */` |
| CTA | `/* ── CTA ── */` |
| Footer | `/* ── FOOTER ── */` |

Grep for the marker to find the exact line range:
```bash
grep -n "── " styles.css
```
