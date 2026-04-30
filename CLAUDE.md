# VerdeVision Website

Marketing landing page for **VerdeVision** — a landscape design app for Apple Vision Pro that lets users place virtual plants in their real yard at full scale. The site's job is to explain the product and capture demo bookings.

## Stack

Plain static site. No build step, no framework, no package.json.

- `index.html` — single page, all sections inline
- `styles.css` — all styling, design tokens at the top in `:root`
- `main.js` — scroll-spy nav + custom calendar booking widget
- `verde_vision_logo.png` — favicon + hero logo
- `DemoRecording.mov` — autoplay hero video

To preview: `open index.html` (the file:// URL works fine — no server needed).

## Page structure

`index.html` is a single landing page composed of these sections, in order:

1. **Nav** (fixed, blurred) — anchors to `#features`, `#who`, `#why`, `#booking`
2. **Hero** — logo, headline with gradient `<em>`, two CTAs, demo video
3. **Features** (`#features`) — 7-card grid of product capabilities
4. **Who It's For** (`#who`) — 4-card audience grid (homeowners, designers, nurseries, developers)
5. **Why Vision Pro** (`#why`) — two-column pitch on spatial design
6. **Coming Soon** — roadmap bullets
7. **Booking** (`#booking`) — three-column card: calendar → time slots → contact form
8. **CTA** — final book/contact buttons
9. **Footer**

When adding a new section, give it an `id` if it should be a nav target and add an entry to the nav links in `index.html`. The scroll-spy in `main.js` automatically picks up any `section[id]`.

## Design system

Tokens are CSS variables in `:root` ([styles.css:3](styles.css)). Use them — don't hardcode colors.

### Color palette

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0a0a0a` | Page background |
| `--bg-alt` | `#111111` | Alternating section background |
| `--card` | `#111111` | Card background |
| `--border` | `#1e1e1e` | Borders, dividers |
| `--accent` | `#1fc47a` | Primary accent — CTAs, selected states, icons, labels |
| `--gold` | `#c9a84c` | Gold accent — used sparingly for prestige highlights |
| `--white` | `#ffffff` | Headings |
| `--text` | `#b8b8b8` | Body copy, subheads |
| `--text-muted` | `#555555` | Captions, fine print |

Section rhythm: alternate transparent (over `--bg`) and `--bg-alt` backgrounds. Every section uses the `.section-label` → `h2` → `.section-intro` heading pattern.

Buttons: `.btn-primary` (filled emerald mint) and `.btn-secondary` (outlined). Both already wired for `:disabled`.

### Typography

Font: **Inter** (loaded from Google Fonts, weights 400–800) — used for all text, no secondary font.

| Level | Size | Weight | Tracking |
|---|---|---|---|
| Display | 64px | 700 | -0.04em |
| H1 | 48px | 700 | -0.03em |
| H2 | 36px | 600 | -0.025em |
| Subhead | 22px | 500 | -0.015em |
| Body | 16px | 400 | normal |
| Body sm | 14px | 400 | normal |
| Label | 12px | 500 | 0.06em + uppercase |

Color usage in type:
- `--white` for display headings (primary line of a split headline)
- `--text` for subheads and body
- `--accent` for section labels AND accent line(s) of split headlines (e.g., `<h1>See Your Yard <span class="accent">Before You Build It.</span></h1>`)
- `--gold` is reserved — do not use for headlines, only sparingly for prestige micro-accents (e.g., a "Premium" badge)

### Iconography

- Library: **Lucide Icons** (line/outline style)
- Color: `--accent` (`#1fc47a`)
- Do not use emoji icons — replace with Lucide equivalents
- Corner radius on **cards, inputs, calendar, and surface containers**: `6–8px`
- Corner radius on **buttons and pill-style CTAs**: `999px` (full pill) — buttons are intentionally pill-shaped, surface elements stay rectangular

### Visual style

- Clean modern SaaS marketing aesthetic — bright mint accent on near-black, generous whitespace
- Hero pattern: two-column on desktop (left = headline + subhead + CTAs, right = product visual / Vision Pro mockup), stacked on mobile
- Decoration: Lucide icons + subtle ambient glow where it earns its place (e.g., a low-opacity radial mint glow behind the hero product visual to give it presence). **Avoid heavy gradients in body content** — backgrounds are flat, tokens only.
- Buttons: pill-shaped. Filled mint `--accent` for primary, transparent with `--border` outline for secondary. No box-shadow glows on the buttons themselves.
- Motion: ease-out transitions, 200–350ms, no bouncy springs

## Booking widget

Lives entirely client-side in `main.js`. **No backend** — submitting the form just hides the booking card and shows a local confirmation. If/when this needs to actually send bookings, wire `demoForm`'s submit handler ([main.js:123](main.js)) to a real endpoint.

Behavior:
- Weekends (`getDay() === 0 || 6`) and past days are disabled
- Time slots are hardcoded in `TIMES` ([main.js:24](main.js))
- Confirmation contact email shown elsewhere on the page: [jasonjlee2004@gmail.com](mailto:jasonjlee2004@gmail.com) ([index.html:233](index.html))

## Conventions

- Vanilla JS, no jQuery, no bundler. Keep it that way unless there's a real reason to add tooling.
- Mobile breakpoints: `900px` (booking grid collapses), `768px` (Why Vision Pro stacks), `600px` (nav links hidden). Match these when adding responsive rules.
- All anchors use smooth scroll via `html { scroll-behavior: smooth }`.

## Things to be careful about

- The hero video is `.mov` served as `video/mp4` — works in Safari/Chrome but may not in all browsers. If we ever need broad compatibility, transcode to actual `.mp4` (H.264).
- `nav` is fixed and ~70px tall. New sections should account for this offset when scrolled to via anchor (the existing sections use generous top padding, which absorbs it).
- The booking confirmation uses `display: none` → `.visible { display: block }`. Don't switch it to opacity-based animation without also updating the toggle in `main.js`.
