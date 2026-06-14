# Sing My Birthday — Team Operating Guide

A short, non-technical guide to the admin tools. For Hicrete, Alejandro, and Ray.

> Golden rules (read first):
> - **Never post a song publicly unless its package is approved.** "Needs
>   permission" and "private / minor" packages are off-limits — no exceptions.
> - **Nothing posts to social automatically.** The tools help you prepare; a
>   human always does the actual posting.
> - **No automatic emailing of leads.** Outreach is researched automatically, but
>   contacting anyone is a manual decision.

---

## Getting in

- Go to **`/admin`** on the site and log in with the admin password.
- The password is shared privately by the founder — it is **not** written in this
  doc or anywhere in the code. If you don't have it, ask.
- Everything under `/admin` is private and only visible after you log in.

---

## Content Packages — `/admin/content-packages`

A **Content Package** is one customer's finished birthday song bundled up for
possible social use: the share link, the video/audio, recipient first name, and
ready-to-copy captions.

Each package has a **permission status**:

| Status | Meaning | Can we post it? |
|---|---|---|
| **approved-for-promo** | The customer ticked the box letting us feature their song. | ✅ Yes — after Hicrete approves it. |
| **needs-permission** | No permission on record. | ❌ No. |
| **private / minor** | Customer declined, **or** the song is for a child. | ❌ No — never. |

### Why "needs-permission" can't be posted
We only feature a song publicly if the customer **explicitly gave permission**.
If there's no recorded "yes," we treat it as **no** (this is deliberate and
protects the brand and our customers). Most packages start here — that's normal.
They become postable only when a customer grants permission.

### How Hicrete reviews (the daily job)
1. Open **`/admin/content-packages`**.
2. Use the **quick-filter chips** or the **⭐ Weekend Queue** tab (below).
3. Click **Review →** on an `approved-for-promo` package.
4. Read it, then click **Approve** (or **Decline** with a note). Approve is only
   possible for permission-cleared, non-minor songs — blocked buttons explain
   why on hover.
5. After you post it on social, come back and click **Mark posted**.

---

## Weekend Queue — `/admin/content-packages?view=weekend`

A focused view that shows **only the songs cleared to post right now**
(approved + permission granted + not a child). Each card has the media links and
**copy-ready captions** in several angles:
- reaction / reveal clip
- birthday song gift
- venue / party use
- "pop-star birthday vibe" (kept generic — we never claim a celebrity endorses us)

Grab a caption, post it on the platform, then **Mark posted** on the package.
Blocked songs intentionally do **not** appear here.

---

## Outreach — `/admin/outreach`

A working list of **UAE venues** (party venues, kids venues, family
restaurants, etc.) that could partner with us. This is Alejandro's list.

Each lead has a **status** Alejandro updates by hand:
`new → shortlisted → contacted → replied → partnered` (or `not_relevant`).

### How Alejandro should work the list
1. Open **`/admin/outreach`**.
2. **Shortlist** the best fits (kids party venues and party planners are usually
   the strongest), especially ones that already show a **phone or website**.
3. **Contact them yourself** (call / email / DM) — the tool does **not** email
   anyone automatically.
4. Update the lead's **status** and **notes** as you go. Your edits are kept even
   when the list refreshes automatically.

---

## Social Tracker — `/admin/social`

A simple **log** of what we've posted (or plan to post): platform, link, caption,
status (planned / posted / skipped), and the date. It is a **record-keeping
tool only** — it does **not** post anything to TikTok/Instagram/etc.

---

## What's automatic vs. manual

**Automatic (runs daily on its own):**
- Finished songs are bundled into Content Packages and sorted by permission.
- The UAE venue list refreshes (currently Dubai-focused, small daily batch).

**Always manual (a human decides and does it):**
- Approving a package for posting.
- Actually posting to social.
- Contacting / emailing any venue lead.
- Approving anything that needs permission (never automatic).

---

## Safety rules (non-negotiable)

- ❌ Never use a customer's song publicly without recorded permission.
- ❌ Never post anything for a child / minor recipient.
- ❌ No auto-posting to social platforms.
- ❌ No automatic emailing of venues or customers.
- ✅ When in doubt, leave it in the queue and ask — fail safe, not fast.
