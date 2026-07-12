# The Book of Knowledge — Sing My Birthday

> A practical marketing workbook. Not theory to admire — a **formula to run**.
> Every section: the concept → how it applies to *us* → an experiment to trial →
> the metric that proves it → a log to record what happened. Test → trial →
> implement → improve. Then repeat.
>
> Structure follows the classic strategy stack: **5 Cs → STP → 4 Ps →
> Acquire + Retain → Profit/ROI → Control**. Analysis flows down; results flow
> back up to the next round of analysis.
>
> **How to use it:** pick ONE experiment, run it for a defined window, fill in
> the results table, keep or kill it, then move to the next. Don't run ten at
> once — you won't know what worked. One change, one metric, one verdict.

---

## The measurement backbone (read this first)

We can't "improve" what we don't measure. Everything below leans on the funnel
events already wired into the product (Vercel Analytics). Learn these — they are
the vocabulary of every experiment in this book:

| Event | Fires when | Tagged with |
|---|---|---|
| `landing_cta_click` | Visitor starts from the landing page | — |
| `generate_page_view` | Reaches the create flow | — |
| `gen_lyrics_click` / `lyrics_generated` | Lyrics requested / produced | — |
| `gen_music_click` / `song_ready` / `song_failed` | Song generation | — |
| `paywall_viewed` | Sees the unlock/paywall | `tier`, `launch_percent` |
| `plan_selected` | Picks Standard/Deluxe/Production | `plan`, `tier` |
| `unlock_click` | Starts checkout | `plan`, `tier`, `launch_percent` |
| `song_unlocked` | **Completes a real purchase** | `plan`, `tier`, `launch_percent` |
| `share_click` / `share_page_view` | Sharing + recipients opening | — |

**The one number that rules them all:** *Revenue per visitor* = conversion rate ×
average price. Low prices usually win on conversion and lose on revenue/visitor —
so never judge a price change on conversion alone. `song_unlocked` × price ÷
`paywall_viewed` is the scoreboard.

---

## 1. Input — Marketing Analysis (The 5 Cs)

*Who and what we're playing with, before we touch a single tactic.*

### Customers — who actually buys
Two distinct buyers, and they think differently:
- **The gift-giver** (primary): buying a birthday song *for someone they love*.
  Emotionally motivated, less price-sensitive, wants it to feel special. Cares
  that it's *good*, not that it's cheap. Too-cheap can even repel ("a $6 gift").
- **The self-tryer / novelty buyer**: "let me try this for fun." Price-sensitive,
  impulse, coffee-money logic ($6–7 and I'll try it).

> **Insight:** our tiers already serve both — the entry price catches the tryer,
> Deluxe catches the gift-giver. Don't collapse them.

### Company — what we uniquely have
- A **free, name-anchored preview** (the buyer *hears their person's name sung*
  before paying) — this is our single biggest trust asset.
- A full **"premiere" deliverable**: song + MP3 + share video + slideshow, framed
  as a cinematic reveal, not a file.
- **Geo-tiered pricing** infrastructure + a reversible **launch discount** lever.
- **Instrumented funnel** (above) — we can actually learn.
- AI-character birthday *phone call* (Production tier) as a premium anchor.

### Competitors
- **Human-musician services (e.g. Songfinch, ~$199):** far pricier, slower — our
  positioning is "the same emotional gift, instant, for a fraction."
- **Generic AI song apps ($5–30):** cheaper/commoditized — we win on the
  *personalized premiere experience* + the name-in-the-song hook + gift framing.
- **Free e-cards / generic "Happy Birthday":** the status quo we replace.

### Collaborators
- **Suno** (song gen), **OpenAI Whisper** (name timing/captions), **Remotion/
  Lambda** (video), **Resend** (email), **Stripe** (payments), **Vercel** (host).
- **Venues** (the venue portal / co-branded flow) — a B2B2C distribution channel.
- Future: **influencers / creators** for word-of-mouth seeding.

### Context
- AI-generated media is *newly* good and *newly* trusted-enough to pay for.
- Birthdays are a **non-stop, evergreen, global** occasion → constant demand, no
  seasonality cliff.
- Word-of-mouth is native: every gift is *shown to the recipient and their circle*.

**5 Cs — working assumptions to challenge:**

| Assumption | Do we believe it? | Evidence to gather |
|---|---|---|
| Gift-givers are our biggest segment | | Survey buyers: "for you or someone else?" |
| Name-in-preview drives the purchase | | A/B preview with vs without name |
| Recipients become next buyers | | Track `share_page_view` → new `generate_page_view` |

---

## 2. STP — Segmentation, Targeting, Positioning

### Segmentation — ways to slice the market
- **By relationship:** partner, parent, child, best friend, colleague.
- **By occasion:** birthday (core), but adjacent — anniversary, new baby,
  graduation, "just because." (Expansion path.)
- **By geo/PPP tier:** already coded (Tier A / B / C) — drives price.
- **By buyer intent:** gift vs novelty (see 5 Cs).

### Targeting — where to point first
Start narrow and winnable: **gift-givers buying for a partner or close family
member, in Tier-A markets, in the week before the birthday.** Highest intent,
highest willingness-to-pay, clearest emotional hook.

### Positioning — the sentence in their head
> *"A personalized birthday song that says their name — a real premiere you can
> gift in minutes, not a generic card."*

We position on **emotion + personalization + instant**, anchored against the
~$120 live-musician option so the paid tiers read as the smart middle.

**STP experiment:**

| Field | Entry |
|---|---|
| **Hypothesis** | Leading with "hear their name" beats leading with "AI birthday song" |
| **Trial** | Two landing headlines; split traffic |
| **Metric** | `landing_cta_click` → `song_ready` rate |
| **Window** | 2 weeks or 500 visitors/variant |
| **Result** | _(fill in)_ |
| **Verdict** | keep / kill / iterate |

---

## 3. Implementation — Marketing Mix (The 4 Ps)

### Product — what they actually get
The **premiere**, laddered good-better-best:
- **Standard / "Premiere"** — full song + MP3 + share video + replay.
- **Deluxe** *(most chosen)* — + photo slideshow video.
- **Full Production** — + AI-character birthday phone call.

Levers to trial: preview length/anchor (currently 24s, name-anchored),
the reveal/"curtain" experience, which tier is defaulted/badged.

### Place — where it happens
- **Web app** (create → preview → unlock → share).
- **Sharing rails:** WhatsApp & Telegram (built in) — the product distributes
  itself when the gift is shown.
- **Venues** — co-branded distribution.
- Trial: which share channel drives the most *recipient opens* → new buyers.

### Price — the highest-leverage lever we have
Current ladder (Tier A / B / C):

| Plan | Tier A | Tier B | Tier C |
|---|---|---|---|
| Standard | $14.99 | $9.99 | $6.99 |
| Deluxe | $24.99 | $16.99 | $11.99 |
| Production | $44.99 | $29.99 | $21.99 |
| *(live anchor, display only)* | ~$120 | | |

**Strategy in force:** keep the base price stable; run a **reversible launch
discount** (currently 50% via `NEXT_PUBLIC_LAUNCH_DISCOUNT_PERCENT`) so early
trial is cheap *without* permanently anchoring low — ending it never looks like a
price hike. The free preview + "love it or it's free" guarantee carry the risk
reversal so price can do the brand/margin job.

> **This is the flagship experiment of the whole book** — see Control & Evaluation.

### Promotion — how they hear about us
- **Word-of-mouth** (primary bet): every recipient is a demo. Engineer it.
- **Referral loop:** give the buyer a reason + a link to make the *next* one.
- **Content/social:** real reaction clips (with consent) — the premiere is
  inherently shareable.
- **Occasion triggers:** birthday reminders → re-engagement (LTV).

**4 Ps experiment (Promotion):**

| Field | Entry |
|---|---|
| **Hypothesis** | A post-purchase "make one for a friend, they get X% off" prompt lifts repeat/referral |
| **Trial** | Add referral CTA on the unlocked share page |
| **Metric** | referred `generate_page_view` → `song_unlocked` |
| **Window** | 3 weeks |
| **Result** | _(fill in)_ |
| **Verdict** | |

---

## 4. Output — Acquiring + Retaining Customers

### Acquiring
The funnel, stage by stage — each drop-off is an experiment waiting to happen:

```
landing_cta_click → generate_page_view → song_ready → paywall_viewed
   → unlock_click → song_unlocked
```

Find the **biggest single drop-off** and attack it first. (Common suspects:
`paywall_viewed → unlock_click` = price/value objection; `song_ready →
paywall_viewed` = they didn't finish/preview didn't land.)

- **CAC** (once paid acquisition starts) = ad spend ÷ new `song_unlocked`.
- Guardrail: CAC must stay below contribution margin (see §5).

### Retaining
Birthdays repeat — this is a **recurring occasion**, not a one-off:
- **Annual birthday reminders** (opt-in, already built) → the same buyer, next
  year, and for *other people's* birthdays.
- **Expand occasions** — anniversaries, new baby, etc. — same buyer, more reasons.
- **LTV = purchases/year × price × years retained.** A buyer who makes 3
  gifts/year is worth 3× a one-timer at zero extra acquisition cost.

**Acquire/Retain experiment:**

| Field | Entry |
|---|---|
| **Hypothesis** | Fixing the top funnel drop-off lifts overall conversion >20% |
| **Trial** | Identify biggest drop in analytics → one targeted fix |
| **Metric** | end-to-end `landing_cta_click` → `song_unlocked` |
| **Window** | 2 weeks pre/post |
| **Result** | _(fill in)_ |
| **Verdict** | |

---

## 5. Output — Profits and ROI

*A sale isn't profit. Know the unit economics or you'll scale a loss.*

**Per-song variable cost (COGS)** — estimate and keep current:

| Cost item | Rough est. | Notes |
|---|---|---|
| Suno generation | | song gen |
| OpenAI (lyrics + Whisper timing) | | Whisper now runs per generation |
| Video render (Remotion/Lambda or ffmpeg) | | fires on unlock |
| Email (Resend) | | song-ready + reminders |
| Storage/bandwidth (Vercel Blob) | | audio + video |
| Stripe fee | ~2.9% + 30¢ | per paid order |
| **Total COGS/song** | **_(fill in)_** | |

- **Contribution margin** = price − COGS. At $6.99 vs $14.99 this is very
  different — and *free previews that don't convert still cost COGS*, so trial
  volume × non-conversion is a real line during a discounted launch.
- **The scoreboard metric: Revenue per paywall view** = (`song_unlocked` ×
  avg price) ÷ `paywall_viewed`. Optimize *this*, not conversion or price alone.

**Profit experiment:**

| Field | Entry |
|---|---|
| **Hypothesis** | Deluxe mix-shift (more people pick Deluxe) raises AOV without hurting conversion |
| **Trial** | Change Deluxe framing/badge/value bullets |
| **Metric** | AOV + `plan_selected` distribution + overall conversion |
| **Window** | 2 weeks |
| **Result** | _(fill in)_ |
| **Verdict** | |

---

## 6. Control & Evaluation — the loop that makes this a *formula*

This is what turns a slide into a system. Run it on a cadence.

### The flagship experiment: the price / launch-discount test
Everything is now instrumented to answer *"what's the right price?"* with data
instead of opinion:

1. **Baseline:** with the launch discount OFF, record over a fixed window —
   `paywall_viewed`, `song_unlocked`, avg price → **revenue per paywall view**.
2. **Variant:** turn the discount ON (e.g. 50%) — `launch_percent` tags every
   event, so the two populations are cleanly separable.
3. **Compare** revenue-per-paywall-view (NOT conversion) and downstream referral.
4. **Decide:** keep the discount, change the %, or return to full price — the
   base price never moved, so any direction is friction-free.

| Field | Entry |
|---|---|
| **Hypothesis** | 50% launch beats full price on revenue/visitor once referral is counted |
| **Trial** | Discount ON window vs OFF window (`launch_percent` split) |
| **Metric** | (`song_unlocked` × price) ÷ `paywall_viewed`, by `launch_percent` |
| **Window** | Enough traffic for significance (target ≥ N per arm) |
| **Result** | _(fill in)_ |
| **Verdict** | |

### The operating rhythm
- **Weekly:** read the funnel. Where's the biggest drop? Is one experiment live?
- **Per experiment:** one change, one metric, one window, one verdict — logged below.
- **Monthly:** promote what won into the default; retire what lost; feed learnings
  back into the **5 Cs** (top of the stack) for the next cycle.

### Experiment log (the real Book of Knowledge — fill it forever)

| # | Date | Hypothesis | Change made | Metric | Result | Verdict (keep/kill) |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |

---

## The formula, in one breath

> **Analyze (5 Cs) → choose a fight (STP) → build the offer (4 Ps) → grow &
> keep (Acquire/Retain) → check it pays (Profit/ROI) → measure, decide, repeat
> (Control).** One experiment at a time. Keep what the numbers reward. The
> discipline *is* the moat.

*Living document — every teammate adds a row to the experiment log. That log,
over time, is our real competitive advantage: knowledge nobody can copy because
we earned it on our own customers.*
