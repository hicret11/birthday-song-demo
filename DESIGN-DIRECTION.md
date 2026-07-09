# Sing My Birthday — Design Direction

_Art direction for a calmer, clearer, more premium product. v1 — for founder sign-off._

---

## The problem, stated plainly

The product is warm and full of good ideas, but it **says everything at once**. On
`/generate`, before a visitor types a single letter, the screen restates the same idea
six times:

> a kicker (“THE PRODUCTION STUDIO”) → a gold badge (“YOU’RE THE DIRECTOR TONIGHT”)
> → a gradient headline (“the main character”) → a paragraph (“Not a form…”) → a giant
> lightbulb marquee (“NOW CASTING · YOUR STAR · THE BIRTHDAY PREMIERE”) → a narrator
> bubble (“Hi, I’m Milo…”) — **and only then** the name field.

Meanwhile the two hero pages live in **two different visual worlds**: the landing is a
warm, editorial, paper-and-ink world; `/generate` is a dark purple neon world. A premium
product feels like **one hand made all of it**.

The result reads as *busy*, not *confident*. Calm is not the absence of personality — it
is personality expressed **once, well**.

## North star

> Every screen has **one focal point**, **few words**, and **room to breathe**.
> The theatrical “production studio / premiere” idea stays — but it is carried by a single
> tasteful motif, not shouted by every element on the page.

We are **not** changing the concept, the copy intent, the flow, the backend, i18n, or the
paywall. This is a **visual + hierarchy** pass: what competes, what recedes, what’s cut.

---

## Principles

1. **One thing per screen.** Each step/section earns a single job and a single primary
   action. If two elements fight to be the hero, one loses.
2. **Say it once.** A field gets *either* a label *or* a narrator line — not a kicker
   **and** a label **and** a hint **and** Milo. Pick the clearest one; delete the rest.
3. **Progressive disclosure.** Optional and advanced inputs (pronunciation, “your name”,
   the full call-sheet dossier) stay collapsed until asked for. Never show the dossier and
   the full form at the same time.
4. **Whitespace is a feature.** Generous, consistent spacing does the work that borders,
   boxes, and glows were doing. Prefer air over dividers.
5. **One accent, used sparingly.** Colour marks the *action*, not the décor. Gradients and
   gold are rare, high-value moments — never body text, never labels.
6. **One material world.** Landing and `/generate` share the same paper, ink, type, and
   accent. Theatre is a *motif inside* that world (a thin marquee rule, a ticket edge), not
   a second theme.
7. **Type carries the tone.** A confident display serif/sans pairing and a real type scale
   replace decorative noise. Hierarchy comes from size and weight, not from colour.
8. **Motion is a whisper.** One quiet entrance per view. Looping glows, drifting notes, and
   neon flicker are removed or made near-invisible. Respect `prefers-reduced-motion`.

---

## Tokens

The existing token set in `app/globals.css` is already good — warm, dual-theme, and
semantic. We **keep it** and tighten how it’s used. No token renames (that would ripple
through unredesigned pages); the discipline is in **usage rules**, below.

### Palette (semantic — do not hardcode hex in components)

| Token            | Light      | Dark       | Use for                                            |
|------------------|------------|------------|----------------------------------------------------|
| `cream`          | `#f3ebdd`  | `#17120f`  | page background                                     |
| `cream-soft`     | `#fbf5ea`  | `#241c17`  | cards / raised surfaces                             |
| `sand`           | `#e9ddc9`  | `#3a2d24`  | borders, dividers, tracks                          |
| `ink`            | `#241b18`  | `#f6ede2`  | primary text                                       |
| `ink-soft`       | `#6f625b`  | `#b4a498`  | secondary text, helper hints                       |
| `tan`            | `#eaddcd`  | `#4a3a2f`  | oversized step numerals, faint marks               |
| `forest`         | `#14352f`  | `#1d4a40`  | the one dark “promise” band                        |
| `noir`           | `#211915`  | `#211915`  | always-dark player/preview panel only              |

**Accent hierarchy — the rule that fixes “gold everywhere”:**

| Tier | Token(s)                     | Allowed uses                                                             |
|------|------------------------------|-------------------------------------------------------------------------|
| **Primary action** | `jade` / `jade-deep` | Primary buttons, active/selected state, focus ring, inline “✓” marks. This is the workhorse. |
| **Hero emphasis**  | `warm-gradient`, `blush` | **One** emphasized phrase per page (the H1’s key words) and the hero artifact. Nothing else. |
| **Premium metal**  | `gold`               | Rare, small, *earned* moments only — a premiere seal, a single marquee hairline, a “director’s cut” chip. **Never** for labels, kickers, or paragraphs. |
| **Peach**          | `peach`              | Soft decorative fills on dark bands only.                               |

> Retire: full-label gold text, gold kickers, the neon purple `/generate` world, and the
> `brand-*` legacy pink/purple gradient on any redesigned surface.

### Type

Three families, already loaded — keep, but assign clear roles:

| Family                       | Token         | Role                                                        |
|------------------------------|---------------|-------------------------------------------------------------|
| Bricolage Grotesque          | `font-display`| Headlines, step titles, card titles, button labels          |
| Plus Jakarta Sans            | `font-sans`   | Body, inputs, helper text, chips (default `body`)            |
| Instrument Serif *(italic)*  | `font-serif`  | **One** accent phrase per section (the “just for them” move) |

**Type scale** (use these steps; don’t improvise sizes):

| Step      | Size / line-height        | Use                                  |
|-----------|---------------------------|--------------------------------------|
| Display   | `clamp(2.5rem, 6vw, 4.5rem)` / 1.02 | Landing H1                 |
| H1        | `2.25–3rem` / 1.05         | Page titles (`/generate`)            |
| H2        | `1.875–2.25rem` / 1.1      | Section headers                      |
| H3        | `1.125–1.25rem` / 1.3      | Card / step titles                   |
| Body-L    | `1.125rem` / 1.6           | Hero subhead, intros                 |
| Body      | `1rem` / 1.6              | Default                              |
| Small     | `0.875rem` / 1.5          | Helper hints, meta, chips            |
| Micro     | `0.75rem` uppercase, `tracking-[0.18em]` | **Rare** eyebrows — max one per view |

Rule: **at most one uppercase micro-label per view.** The kicker *or* the badge — not both.

### Spacing & rhythm

- **4px base.** Standard steps: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`.
- **Section vertical rhythm:** `py-20` desktop / `py-14` mobile between major sections.
- **Card padding:** `p-6` (mobile) → `p-8` (desktop). Inputs stack at `space-y-5`.
- **Content width:** prose/forms `max-w-xl`–`max-w-2xl`; full sections `max-w-6xl`.
- **Radii:** inputs/buttons `rounded-2xl`; cards `rounded-[1.75rem]`; pills `rounded-full`.
- **Elevation:** one soft shadow token, `shadow-[0_24px_60px_-30px_rgba(60,40,30,0.35)]`.
  Prefer a hairline `border-sand` + air over stacked glows.

---

## Component patterns

**Buttons**
- *Primary:* solid `bg-jade text-white`, `rounded-full`, `px-7 py-3.5`, `font-display
  font-bold`, one hover lift. The warm-gradient fill is reserved for the **single** hero
  CTA per page, not repeated on every band.
- *Secondary:* `bg-transparent border border-sand text-ink`, same geometry.
- *Ghost/link:* `text-ink-soft hover:text-ink`, no box.
- Disabled = `opacity-50`, and put the reason in quiet helper text **below**, not shouting.

**Cards / surfaces**
- `bg-cream-soft border border-sand rounded-[1.75rem] p-6 sm:p-8`, single soft shadow.
- No nested cards. A card holds one idea. Grain optional at ≤0.4 opacity.

**Inputs**
- `bg-cream-soft border border-sand rounded-2xl px-4 py-3.5 text-ink
  placeholder:text-ink-soft/70`, focus `ring-2 ring-jade border-transparent`.
- **Label _or_ placeholder, not both saying the same thing.** Optional fields carry a quiet
  `(optional)` in `ink-soft` — no second hint line unless it adds real info.

**Chips / style pills**
- `rounded-full border border-sand bg-cream-soft px-4 py-2 text-sm font-semibold`.
- Selected = `border-jade bg-jade/10 text-ink` + a small jade ✓. Colour swatch stays small.
- The style row is a **calm palette**, not six loud gradients competing with the hero.

**Page header (shared)**
- Logo-mark + wordmark left; `My songs` link + theme toggle right. `max-w-6xl`, `py-6`.
- No kicker stacked above the H1 by default.

**Section header**
- H2 in `font-display`, optionally **one** `font-serif italic` accent word. No eyebrow
  label above it unless the section genuinely needs orienting.

**The narrator (“Milo”)**
- Milo keeps his role, but stops narrating every field. Guidance collapses into: (a) the
  input’s own placeholder/label, or (b) **one** short line at the top of a step — never a
  persistent bubble that duplicates the label beneath it. The floating narrator toggle is
  quieted (smaller, lower-contrast, out of the primary column).

**The “production studio” motif**
- Expressed as **one** restrained device per relevant screen — e.g. a thin gold marquee
  **hairline** or a ticket-stub notch — rendered in the warm palette. The full lightbulb
  marquee + casting copy + badge + Milo intro collapse into a **single** quiet hero: title,
  one-line intent, and the name field. Concept and copy intent preserved; volume cut.

---

## How this maps to the two hero pages

**Landing** (already close): calm the loud pink STYLES band into the warm palette, ensure
gold/gradient appear only in the hero phrase + one CTA, verify one accent word per section,
tighten section rhythm. Keep the editorial numbered “how it works” and divider FAQ.

**/generate**: bring it into the warm world (light + warm-charcoal dark). Collapse the
six-fold hero into **one** focal hero (title + single intent line + name field). Move
pronunciation / “your name” / the call-sheet dossier behind progressive disclosure so the
first screen shows **one question**. Retire neon purple and gold labels. Milo speaks once
per step, not per field.

---

## Site-wide rollout (applied after landing + /generate sign-off)

The system is now applied across the product. Guiding rules used:

- **One action color.** Every primary action is solid `jade` (hover `jade-deep`); the
  legacy `brand-pink → brand-amber` gradient and `brand-pink` focus/selected/accent states
  are retired everywhere (join/crowd, chip-in, cast add-ons + character picker, cast-booked,
  onboarding, happy-birthday, become-a-venue, paywall). Selection states use a single jade
  ring — no more jade/gold/blush fighting per tier.
- **Global chrome re-skinned to warm** (these overlay every page): CookieConsent banner +
  preferences modal, WaitlistForm, LanguageSwitcher — all migrated off the dark purple /
  white-on-glass world onto cream/ink/jade tokens, dual-theme.
- **Venues.** Per-venue `logo_color` branding is preserved; only the off-world purple
  `FALLBACK_COLOR` became jade.
- **Kept as deliberate variety (not flattened):** the share-card *templates*
  (Classic/Elegant/Neon/Playful/Corporate) and their poster previews — these are a
  user-chosen "pick your card style" feature, so their distinct looks stay.
- **Earned accents that remain:** the hero-word `warm-gradient` (one per page), small
  brand logo/step chips in `warm-gradient` (as on the landing), and a single `gold` ★ on the
  Deluxe tier as premium metal.

### The one exception — the cinematic payoff (kept dramatic on purpose)

Calm everywhere **except** the moment meant to give chills. The **premiere reveal**
(`PremiereReveal`: curtain-raise → name-in-lights → song → director's note → credits roll)
and the **countdown "premiere ticket"** (`PremiereCountdown`) stay dark and theatrical.
What changed: they were shifted off leftover flat "app purple" onto an **intentional warm
gold-lit theater** palette (warm aubergine house, amber/gold stage light, velvet curtains,
white→gold→pink name-in-lights), stacked kickers trimmed, and the ticket given real
stub-notches so it reads as a premium admission ticket, not a plain card.

## Definition of done (the bar we grade against)

A screen passes when a first-time visitor can answer, in under two seconds:
**“What is this and what do I do next?”** — with one obvious focal point, no duplicated
copy, accents used sparingly, and landing + `/generate` unmistakably the same product.
