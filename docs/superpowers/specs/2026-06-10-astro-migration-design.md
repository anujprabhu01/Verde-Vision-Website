# VerdeVision — Astro Migration Design

**Date:** 2026-06-10
**Goal:** Migrate the VerdeVision marketing site from a plain HTML/CSS/JS monolith to Astro, fixing performance and cross-device consistency issues.

---

## Context

The current site is a single-file static site (`index.html` + `styles.css` + `main.js`) deployed on Vercel at useverdevision.com via the `anujprabhu01/Verde-Vision-Website` GitHub repo. It is slow, laggy, and behaves inconsistently across devices (iOS vs Android vs desktop, different OS/browsers).

**Root causes identified:**
- ~20MB of unoptimized PNG images loaded on every page visit
- 70KB global CSS with accumulated dead code and specificity conflicts
- 42KB monolithic JS that runs everything on page load (including off-screen animations)
- 3 Google Fonts stylesheet requests blocking render
- Hand-rolled mouse/touch handlers causing cross-device inconsistencies
- Missing CSS vendor prefixes
- `100vh` iOS viewport bug hiding content under browser chrome

---

## Tech Stack

**Framework:** [Astro](https://astro.build) — purpose-built for content/marketing sites. Ships zero JS by default; interactive parts load as isolated "islands."

**Build pipeline:** Vite (built into Astro) — handles bundling, tree-shaking, PostCSS/Autoprefixer, and image optimization.

**Fonts:** `@fontsource` npm packages — replaces Google Fonts external requests with locally bundled font files served from Vercel's CDN.

**Deployment:** Vercel (unchanged) — native Astro adapter, zero config change needed. Same domain, same repo, same auto-deploy on push to `main`.

---

## Architecture

### File Structure

```
src/
  layouts/
    Layout.astro          # base HTML shell, <head>, meta, OG tags, fontsource imports
  components/
    Nav.astro
    Hero.astro            # static shell + BASlider island
    WhyItWins.astro       # static shell + ScrollPath island
    Features.astro        # uses Astro <Image> for all feature images
    InAction.astro        # static shell + VideoControls island
    Booking.astro         # static shell + BookingWidget island
    CTA.astro             # static shell + CTATree island
    Footer.astro
    islands/
      BASlider.ts         # client:load
      ScrollPath.ts       # client:visible
      VideoControls.ts    # client:visible
      BookingWidget.ts    # client:load
      CTATree.ts          # client:visible
      CanvasGrid.ts       # client:idle
  assets/
    feature-01-design.png   # → auto-converted to WebP by Astro
    feature-02-blueprint.png
    feature-03-estimate.png
    feature-04-persist.png
    feature-05-crew.png
    HeadsetTransparent.png  # PNG preserved (has transparency)
    sunset-mountain.webp    # already WebP, re-optimized at correct display size
    Before.png
    After.png
  styles/
    global.css            # CSS variables/tokens only (~2KB)
  pages/
    index.astro           # assembles all components
public/
  verde_vision_logo.png   # favicon (stays in public, not optimized)
  fonts/
    DepartureMono-Regular.woff2
astro.config.mjs
package.json
```

### Island Loading Strategy

| Island | Directive | Reason |
|---|---|---|
| BASlider | `client:load` | Above the fold, needs to be interactive immediately |
| BookingWidget | `client:load` | User may scroll directly to booking |
| ScrollPath | `client:visible` | Only needed when Why It Wins is in view |
| VideoControls | `client:visible` | Only needed when video section is in view |
| CTATree | `client:visible` | Only needed when CTA section is in view |
| CanvasGrid | `client:idle` | Decorative, lowest priority |

Nav toggle is handled as an inline `<script>` in `Nav.astro` — it's too small (~15 lines) to warrant a separate island file.

---

## Performance Strategy

### Images
All images in `src/assets/` are processed by Astro's `<Image>` component:
- PNG → WebP at correct display dimensions
- Lazy loading added automatically
- Correct `width`/`height` attributes prevent layout shift
- Expected result: ~20MB total → ~600KB total (97% reduction, zero manual work)

`HeadsetTransparent.png` stays as PNG (transparency required) but will be compressed.

### Fonts
Remove the 3 Google Fonts `<link>` tags from `<head>`. Install:
```
@fontsource/inter
@fontsource/fraunces
@fontsource-variable/geist-mono
```
Import in `Layout.astro`. Fonts bundle into the Vercel deployment — zero external requests, no FOUT, works offline.

### CSS
- Each `.astro` component has its own `<style>` block, scoped automatically by Astro
- CSS variables/tokens (the existing design system) preserved in `src/styles/global.css`
- Autoprefixer runs via PostCSS on every build — vendor prefixes added automatically
- Dead CSS is impossible per-component (scoped = only what you write)
- Expected result: 70KB global stylesheet → ~15KB total, zero dead code

### JS
- Current: 42KB monolithic `main.js` runs entirely on page load
- After: Split into focused island scripts, most loaded only when scrolled into view
- Expected result: ~5KB JS on initial load, rest deferred

---

## Cross-Device Fixes

### B/A Slider (touch/mouse bugs)
Replace separate `mousedown`/`touchstart`/`mousemove`/`touchmove` handlers with a single unified Pointer Events API handler (`pointerdown`/`pointermove`/`pointerup`). Works identically across mouse, touch, and stylus on all modern browsers.

### Scroll Jank
Replace `scroll` event listeners (which do layout-triggering `getBoundingClientRect` reads on every frame) with:
- `IntersectionObserver` for reveal animations
- A single `rAF` loop with cached measurements for the path animation

### iOS Viewport Height
Replace `100vh` with `100dvh` (dynamic viewport height) throughout. Fixes the hero content being hidden under iOS Safari's browser chrome. Include `100vh` as fallback for older browsers.

### Vendor Prefixes
Handled automatically by Autoprefixer — no manual intervention needed.

### Canvas Grid on Low-End Devices
Load as `client:idle` (only starts after everything else is loaded). Fully respect `prefers-reduced-motion` — skip animation entirely when set.

---

## Migration Approach

Work on a dedicated `astro-migration` branch throughout. The live site at useverdevision.com remains untouched until the migration is fully tested.

Vercel automatically creates a preview URL for the `astro-migration` branch, allowing end-to-end testing before going live.

**Build order:**
1. Scaffold Astro project + install dependencies + configure Vercel adapter
2. `Layout.astro` — base shell, meta, fonts, global CSS tokens
3. `Nav.astro` + `Footer.astro` — static, no islands needed
4. `Hero.astro` + `BASlider.ts` island (Pointer Events rewrite)
5. `WhyItWins.astro` + `ScrollPath.ts` island (scroll listener refactor)
6. `Features.astro` — migrate all 5 images to `src/assets/`, use `<Image>`
7. `InAction.astro` + `VideoControls.ts` island
8. `Booking.astro` + `BookingWidget.ts` island
9. `CTA.astro` + `CTATree.ts` island + `CanvasGrid.ts` island
10. Cross-device audit (iOS Safari, Android Chrome, desktop Chrome/Firefox/Safari)
11. Merge `astro-migration` → `main` — Vercel auto-deploys

**What stays the same:**
- All copy and content
- Visual design direction (colors, tokens, typography, layout)
- Domain (useverdevision.com)
- GitHub repo (anujprabhu01/Verde-Vision-Website)
- Vercel auto-deploy on push to `main`
- All existing assets (logo, headset image, video CDN URL)

---

## Expected Outcomes

| Metric | Before | After |
|---|---|---|
| Total image weight | ~20MB | ~600KB |
| JS on initial load | 42KB (all at once) | ~5KB (rest deferred) |
| CSS | 70KB global | ~15KB scoped |
| External font requests | 3 | 0 |
| Lighthouse Performance | ~35 | 92+ |
| Lighthouse Accessibility | ~72 | 95+ |
| Lighthouse Best Practices | ~68 | 95+ |
| iOS hero layout bug | Present | Fixed (100dvh) |
| B/A slider cross-device | Inconsistent | Unified (Pointer Events) |
| Vendor prefixes | Manual/missing | Automatic (Autoprefixer) |
