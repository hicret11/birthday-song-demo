# AI Character Birthday Call — go-live checklist

The $44.99 **Full Production** tier bundles an AI character phone call (a wizard,
fairy godmother, or pirate captain phones the birthday person). All the code is
shipped and **env-gated**: with no ElevenLabs/Twilio credentials the call path is
a clean no-op — Production still sells and delivers the full Deluxe song, the
booking is created and left `scheduled`, and nothing dials. This doc is the
operational checklist to switch calling **on**. It's for a non-developer.

> **Do this first, before anything below: confirm counsel sign-off.** We use a
> giver-attests consent model (the gift-giver represents they have the
> recipient's permission). US TCPA treatment of AI/artificial-voice calls puts
> the burden of proof on the caller. Have qualified TCPA/telecom counsel review
> the model and the disclosures in `AI-CALL-SETUP-AND-COMPLIANCE.md` before you
> set the live credentials. The build hardens the model (consent evidence,
> quiet-hours, AI disclosure + callback number) but does not remove that risk.

## 0. Apply the database migration (one-time)

The compliance columns must exist before Production bookings can persist:

```
supabase/migrations/20260709000000_add_cast_consent_and_timezone.sql
```

It's additive + idempotent (adds `consent_ip`, `consent_attestation`,
`consent_at`, `recipient_timezone`, and a one-ai_call-per-gift unique index).
Apply it with the project's migration flow **against production** — requires the
service-role token; run only with explicit approval.

## 1. Twilio

1. Buy a **Voice-capable phone number** (~$1–2/mo). This is the number the call
   comes from.
2. Note the Account SID, Auth Token, and the number in +E.164 form.

## 2. ElevenLabs (paid plan; Creator+ to clone custom voices)

1. Create a **Conversational AI agent** → copy its **Agent ID**.
2. Open the agent's **Security** tab → **enable overrides** for: System prompt,
   First message, Language, and Voice ID.
   **If you skip this, every call errors (422)** — we send the AI disclosure,
   persona, language, and per-character voice as per-call overrides.
3. **Phone Numbers → import** your Twilio number (paste the number, Twilio SID,
   and Auth Token; ElevenLabs auto-configures Twilio). Copy the imported
   number's **ID** (this is the *phone number id*, not the number itself).
4. Pick a **distinct voice per character** — from the Voice Library (copy each
   `voice_id`) or via Instant Voice Clone. You need three voice ids.
5. Profile → **API Keys** → copy an **API key**.

## 3. Set the environment variables (Vercel → Production)

```
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...
ELEVENLABS_AGENT_PHONE_NUMBER_ID=...      # the imported number's ID from step 2.3
ELEVENLABS_VOICE_ZOLTAR=...               # voice_id for the wizard
ELEVENLABS_VOICE_PEARL=...                # voice_id for the fairy godmother
ELEVENLABS_VOICE_CAPTAIN_VERO=...         # voice_id for the pirate captain
CAST_CALLBACK_NUMBER=+1...                # spoken in the greeting (caller callback, 47 CFR 64.1200(b))
CRON_SECRET=...                           # already set — powers the scheduler auth
STRIPE_PRICE_ID_PRODUCTION_A=price_...    # from scripts/stripe-setup.sh (_v3 keys)
STRIPE_PRICE_ID_PRODUCTION_B=price_...
STRIPE_PRICE_ID_PRODUCTION_C=price_...
```

The three `STRIPE_PRICE_ID_PRODUCTION_*` come from running `scripts/stripe-setup.sh`
(they create the `_v3`-keyed Production prices). Without them, a Production
checkout falls back to the Standard price — set them so buyers are charged the
$44.99 ladder.

## 4. How it runs once live

- Buying **Full Production** collects the character, the recipient's phone
  (E.164), an optional call date, and the giver's consent attestation. On
  payment the webhook creates one `cast_bookings` row (idempotent) and marks it
  `scheduled`, with the consent evidence recorded.
- The **`/api/cron/cast-calls`** scheduler (Vercel Cron, `CRON_SECRET`-authed)
  places due calls. It **defers** any call that isn't within **8am–9pm in the
  recipient's local time** (derived from the phone's country, or the stored
  timezone) — so a booking never dials at a rude hour.
- Every call opens with the **AI disclosure** and states the **callback number**,
  then the character's greeting (in the booking's language), the giver's note,
  and a birthday wish.

## 5. Smoke test (test mode)

1. With telephony env **unset**: buy Production in Stripe test mode → confirm the
   song unlocks as a premiere AND a `cast_bookings` row is created `scheduled`
   with consent logged → confirm the cron returns `{skipped: "telephony not
   configured"}` and never dials.
2. With telephony env **set**: book a call to **your own phone**, inside calling
   hours, and confirm it rings, discloses it's an AI, and speaks the greeting.
   Only open it to real buyers after counsel sign-off.
