// English — the default locale and the source of truth for the Dict shape.
// `es` and `tr` are typed as `Dict`, so any missing key fails `tsc`.

export const en = {
  nav: {
    mySongs: "My songs",
  },
  hero: {
    title: "Personalized birthday songs, made for the people you love.",
    subtitle: "For the people you love. In any language. In about a minute.",
    cta: "Create a Free Birthday Song",
    freeNote: "Free · no signup",
  },
  how: {
    title: "How it works",
    step1: "Tell us about them",
    step2: "We make the song",
    step3: "Send the joy",
  },
  footer: {
    madeWith: "Made with love by Sing My Birthday",
    venuePrompt: "Own a venue or event space?",
    venueLink: "For Venues →",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        q: "Is it free to try?",
        a: "Yes. Creating a song and listening to the first 15-second preview is completely free. You only pay to unlock and download the full song.",
      },
      {
        q: "How long does it take?",
        a: "About a minute. Tell us a few details, and your personalized song is written and sung automatically.",
      },
      {
        q: "What do I get?",
        a: "The complete song, an MP3 download to keep forever, and a shareable video for WhatsApp, Telegram, and social. Deluxe also adds a photo slideshow set to the music.",
      },
      {
        q: "Which languages do you support?",
        a: "Any language — we support 7+ and growing, including English, Spanish, and Turkish. Just pick the one you want when you create the song.",
      },
      {
        q: "Is the song really mine to share and use?",
        a: "Yes. Once you unlock it, the song is yours to play, download, share, and send to family and friends however you like.",
      },
      {
        q: "What if I don't love it?",
        a: "We back every song with a money-back guarantee. If you're not happy, let us know and we'll make it right.",
      },
      {
        q: "Is this AI?",
        a: "Yes — it's AI-powered, and you guide it. You choose the name, the details, and the style, then our AI writes and sings a one-of-a-kind song just for them.",
      },
    ],
  },
  generate: {
    // Form field labels / placeholders (conversion path)
    nameLabel: "👤 Who’s the birthday star?",
    namePlaceholder: "Enter their name...",
    ageLabel: "🎂 How old are they turning?",
    agePlaceholder: "e.g., 25",
    languageLabel: "🌍 Choose language",
    genreLabel: "🎵 Pick a genre",
    emailLabel: "📬 Where should we send the song?",
    emailPlaceholder: "you@example.com",
    emailHint: "So we can save your song.",
    attestationAdult: "I am 18 or older.",
    // {name} interpolated by the caller
    attestationGuardianPrefix: "I am 18 or older and the parent or legal guardian of ",
    attestationGuardianFallback: "this child",
    marketingConsent:
      "Email me a birthday reminder next year and the occasional offer. (Optional)",
    // Primary CTAs
    writeLyrics: "✨ Write Lyrics",
    writingLyrics: "Writing lyrics...",
    generateMusic: "🎵 Generate music with these lyrics",
    generatingMusic: "Generating music...",
    rewriteLyrics: "✍️ Re-write lyrics",
    rewriting: "Writing...",
    // Gating hint strings (missingForLyrics / missingForMusic)
    missingAddName: "Add their name",
    missingAge: "Tell us how old they're turning",
    missingGenre: "Pick a genre",
    missingWriteLyricsFirst: "Write the lyrics first",
    missingAddEmail: "Add your email to create the song",
    missingEmailFormat: "Check the email format",
    missingGuardian: "Confirm you're the parent or legal guardian",
    missingTickBox: "Tick the box to continue",
    // Wait-state / loading lines
    waitReady: "Done! 🎉",
    waitSongReady: "Your song is ready",
    waitAboutAMinute: "Your song will be ready in about a minute",
    waitAlmostThere: "Almost there…",
    waitWritingSong: "Writing your song",
    commitmentHint:
      "Happy with the words? Create the song. You can rewrite the lyrics and try again as many times as you like before you do.",
    // Guided-flow step labels (progress header)
    stepDetails: "About them",
    stepLyrics: "Lyrics",
    stepSong: "Song",
    // Trust strip
    trustFreePreview: "✓ Free preview",
    trustNoSignup: "no signup to start",
    trustMoneyBack: "💯 money-back guarantee",
    trustSecureStripe: "🔒 secure checkout by Stripe",
    trustRewriteFree:
      "A real, full song in about a minute — don’t love the words? Rewrite them free, as many times as you want.",
    // Sender recognition — the warm "who are you to them?" step. Its answer
    // becomes the producer credit on the premiere. Chip values stay canonical
    // in state (unchanged lyric-prompt context); only the labels are localized.
    relationshipLabel: "And who are you to them?",
    relationshipOptional: "(optional)",
    relationshipHint: "This becomes your producer credit on the premiere.",
    relationshipFriend: "Their friend",
    relationshipPartner: "Their partner",
    relationshipFamily: "Their family",
    relationshipColleague: "Their colleague",
    relationshipOther: "Someone who loves them",
    // Reimagined intake — "production studio" framing. Presentation only: these
    // strings restyle the same fields as a guided conversation with a producer
    // persona. {name}/{producer} are interpolated by the component.
    studioBadge: "🎬 Not a song generator",
    studioHook: "Let’s make {name} the main character of their birthday.",
    studioHookThem: "them",
    studioHookSub:
      "You’re not filling out a form — you’re the director casting the star. Let’s build the show.",
    producerName: "Milo",
    producerIntro:
      "Hi, I’m {producer}, your producer. I’m not a form — tell me the story and I’ll write it into the song.",
    actCasting: "Act 1 · Casting",
    personHeading: "Who are we making the star tonight?",
    actFeeling: "Act 1 · The feeling",
    vibeHeading: "What feeling should the song leave?",
    producerVibe: "Before I roll tape — what should this song make them feel?",
    producerWait:
      "Give me about a minute to mix the track. While I do — make the gift even more theirs.",
    coauthorTag: "co-authorship",
    coauthorPhotoLabel:
      "Add a few photos of your moments — they become scenes in the premiere.",
    coauthorPhotoCta: "📷 Add photos",
    coauthorPhotoAdding: "Adding photos…",
    coauthorPhotoDone: "{count} added — they’ll appear in the show.",
    // Feeling chips — the emotional target the song should leave (v4 casting).
    feelingLabel: "The feeling to leave them with",
    feelingGoosebumps: "Goosebumps",
    feelingLaughing: "Laughing",
    feelingHappyCry: "Happy tears",
    feelingNostalgic: "Nostalgic",
    feelingHyped: "Hyped up",
    feelingLoved: "Deeply loved",
    // The director’s private note — revealed as the closing beat of the premiere.
    noteHeading: "A private note from the director",
    noteSubtext:
      "Revealed at the very end of their premiere — after the song. Optional.",
    noteTabText: "✍️ Write it",
    noteTabVoice: "🎙️ Record it",
    notePlaceholder: "Say the thing you’d say if the room went quiet…",
    noteRecordCta: "● Record a voice note",
    noteRecordingLabel: "Recording… tap to stop",
    noteStopCta: "■ Stop",
    noteUploadingLabel: "Saving your voice note…",
    noteVoiceReady: "✓ Voice note saved ({seconds}s)",
    noteReRecord: "Re-record",
    noteErrNoMic: "Your browser can’t record audio — write the note instead.",
    noteErrNoAudio: "No audio captured. Try again.",
    noteErrUpload: "Couldn’t save that voice note — try again.",
    // Countdown delivery choice (shown once a birthday is set).
    deliveryHeading: "When should they see it?",
    deliveryOnBirthday: "🎬 Open on their birthday",
    deliveryNow: "Available now",
    deliveryHint: "We’ll hold the premiere behind a countdown until 9am their time on the day. You can always preview it yourself first.",
    deliveryPreviewLink: "Preview your premiere (only you can see it early) →",
  },
  paywall: {
    // Preview label — the 15s cap framed as the trailer/opening of the show
    // (prefix + suffix rendered together; the second is the invitation).
    previewLabelPrefix: "🎬 The opening of their premiere — ",
    previewLabelSuffix: "unlock to raise the curtain",
    // Unlock headline ({name} interpolated by caller)
    unlockHeadlinePrefix: "Raise the curtain on ",
    unlockHeadlineSuffix: "’s full premiere 🎬",
    unlockHeadlineLovedPrefix: "That was just the opening. ",
    // Plan names
    standard: "Standard",
    deluxe: "Deluxe",
    production: "Full Production",
    bestValue: "Best value",
    mostChosen: "Most chosen",
    // Value-stack bullets
    bulletCompleteSong: "The full premiere — the complete song",
    bulletMp3: "MP3 download — keep it forever",
    bulletShareVideo: "A shareable video for WhatsApp & Telegram",
    bulletReplay: "Replay & re-send to family anytime",
    bulletEverythingStandard: "Everything in Standard",
    bulletSlideshow: "A photo slideshow video — their favorite moments set to the song",
    bulletEverythingDeluxe: "Everything in Deluxe",
    bulletCall:
      "An AI character phones them on their birthday — a wizard, fairy godmother, or pirate captain, in their own voice",
    // CTAs ({price} interpolated by caller)
    unlockDeluxePrefix: "Raise the curtain · Deluxe",
    unlockStandardPrefix: "Raise the curtain · Standard",
    unlockProductionPrefix: "Raise the curtain · Full Production",
    openingCheckout: "Opening secure checkout…",
    preparingSong: "Preparing the premiere…",
    moneyBack: "Love it or your money back",
    secureCheckout: "One-time payment · instant unlock · secure checkout by Stripe",
    // Live-musician anchor row ({price} interpolated by caller)
    liveAnchorLabel: "Prefer a real musician in person? Live performances from",
    // Production tier — AI character call setup ({name} interpolated by caller)
    callHeading: "Set up the birthday call 🎬",
    callSubtext: "An AI character will phone {name} to wish them a happy birthday, in their own voice.",
    callCharacterLabel: "Who should call?",
    callPhoneLabel: "{name}’s phone number",
    callPhonePlaceholder: "+1 555 123 4567",
    callPhoneHint: "International format, starting with +",
    callCountryUnavailable:
      "The birthday call isn't available for that country's number yet — the rest of the gift still works.",
    callDateLabel: "When should we call? (optional)",
    callDateHint: "Leave blank to call as soon as it’s ready. We only ever call between 8am–9pm their local time.",
    callConsentLabel: "I have {name}’s permission for them to receive this call.",
    callConsentMicrocopy: "This is a personal birthday greeting, not a marketing call. You’re responsible for having their consent; we record this attestation with your order.",
  },
  // The Premiere — the theatrical reveal of the finished song.
  premiere: {
    overline: "Premiere · opening night",
    // Teaser line, split around the star's name: `{introPrefix}{name}{introSuffix}`.
    introPrefix: "The premiere for ",
    introSuffix:
      " is ready. Dim the lights, turn up the sound — and open on the first scene.",
    openCta: "🎬 Start the premiere",
    marqueeOverline: "Tonight’s star",
    pause: "⏸ Pause",
    replay: "▶ Play again",
    director: "Produced by",
    continueLabel: "Send it to them 💌",
    // Closing beat — the director's private note + the credits roll.
    noteLabel: "A message from the director",
    notePlay: "▶ Play their message",
    notePause: "⏸ Pause",
    starringLabel: "Starring",
    producedByLabel: "Produced & directed by",
    withLoveLabel: "With love from",
  },
  // The locked premiere ticket + countdown (giver-sends scheduled delivery).
  countdown: {
    admission: "Now casting · one night only",
    title: "{name}’s premiere",
    theStar: "the star",
    premieresOn: "Premieres {date}",
    opensIn: "The curtain rises in",
    days: "days",
    hrs: "hrs",
    mins: "min",
    secs: "sec",
    footer: "Made only for them — check back when the curtain rises.",
  },
  // Crowd-magic — invite the recipient's circle to co-write one song.
  crowd: {
    cta: "Make it a group song 💛",
    ctaHint: "Invite their circle to add lines & memories — we’ll weave them into one song.",
    creating: "Starting…",
    linkHeading: "Your group-song link is ready 🎉",
    linkSubtitle: "Share it with their circle — everyone can add a line, a memory, or a wish.",
    copy: "Copy link",
    copied: "Copied ✓",
    share: "Share the link",
    error: "Couldn’t start the group song. Please try again.",
    // Crowd Premiere on the share page. Overline: `{prefix}{N}{suffix}` for the
    // group case (N ≥ 2), or `overlineSolo` otherwise. Credit lists the names.
    premiereOverlinePrefix: "A song from ",
    premiereOverlineSuffix: " people who love you",
    premiereOverlineSolo: "A song made with love",
    withLove: "With love from",
  },
  // The contributor page (/join) — where the recipient's circle adds their bit.
  // Name-bearing lines are split prefix/name/suffix so each language can place
  // the name naturally; {n}/{name} placeholders are filled at render time.
  crowdContributor: {
    metaTitle: "Add your bit to {name}’s birthday song",
    metaDescription:
      "Help make {name}’s birthday song — add a line, a memory, or a wish. It all becomes one song.",
    overline: "A group birthday song",
    headingPrefix: "Help make ",
    headingSuffix: "’s birthday song magical",
    introLead: "Someone who loves ",
    introAfterName: " is making them a song — and wants a piece of ",
    you: "you",
    introTail:
      " in it. Add a line, a memory, or a wish. It all becomes one song they’ll hear on their birthday.",
    liveAdding: "people are adding right now",
    countOne: "💛 {n} person has added their bit",
    countMany: "💛 {n} people have added their bit",
    kinds: {
      line: {
        label: "A lyric line",
        placeholder: "A line for the song — inside joke, nickname, something only you’d say…",
      },
      memory: {
        label: "A memory",
        placeholder: "A moment with them you’ll never forget…",
      },
      wish: {
        label: "A wish",
        placeholder: "What do you wish for them this year?",
      },
    },
    photoTab: "Add a photo",
    voiceTab: "Voice note",
    photoPickPrompt: "Tap to choose a photo of you two",
    photoHint: "JPG, PNG, WebP · up to 6MB",
    photoPreviewAlt: "Your photo preview",
    photoChange: "Change",
    voiceRecordPrompt: "Tap to record a short voice note",
    voiceHint: "Up to 30 seconds",
    voiceRecording: "Recording…",
    voiceStop: "Stop",
    voiceReRecord: "Re-record",
    voicePreviewLabel: "Your voice note",
    voiceCaption: "A voice note",
    submitVoice: "Add my voice note →",
    namePlaceholder: "Your name (optional — so they know it’s from you)",
    uploading: "Uploading…",
    sending: "Sending…",
    addAnother: "Add another 💛",
    submitPhoto: "Add my photo →",
    submitText: "Add it to the song →",
    donePrefix: "✓ Added! You’re part of ",
    doneSuffix: "’s song now.",
    circlePrefix: "What ",
    circleSuffix: "’s people are saying",
    photoFromAlt: "Photo from {name}",
    photoAlt: "A photo for the song",
    photoCaption: "A photo",
    footer: "Sing My Birthday · your words become part of the song",
    fallbackName: "them",
    errNeedText: "Add a few words first.",
    errNeedPhoto: "Pick a photo first.",
    errNotImage: "That doesn’t look like an image — pick a photo (JPG, PNG, WebP…).",
    errTooBig: "That photo is over 6MB — try a smaller one.",
    errSend: "Couldn’t send that — try again.",
    errUpload: "Couldn’t upload that photo — try again.",
    errAddPhoto: "Couldn’t add that photo — try again.",
    errNeedVoice: "Record a voice note first.",
    errMic: "Couldn’t reach your microphone — check permissions and try again.",
    errUploadVoice: "Couldn’t upload that voice note — try again.",
    errAddVoice: "Couldn’t add that voice note — try again.",
    errNetwork: "Network hiccup — try again.",
  },
  // The Cast — book an original character to phone the birthday person (AI voice
  // call). {name}/{price} placeholders are filled at render time.
  cast: {
    ctaTitle: "Send them a magical birthday call 📞",
    ctaSubtitle:
      "Book an original character to phone {name} and wish them a happy birthday — in their own voice.",
    open: "Book a character call",
    close: "Maybe later",
    pickCharacter: "Choose your character",
    from: "from",
    recipientNameLabel: "Who's the call for?",
    recipientNamePlaceholder: "Birthday person's name",
    phoneLabel: "Their phone number",
    phonePlaceholder: "+1 555 123 4567",
    phoneHint: "International format, starting with + and country code.",
    noteLabel: "A personal note (optional)",
    notePlaceholder: "Something for the character to mention — an inside joke, a wish…",
    scheduleLabel: "When should we call? (optional)",
    scheduleHint: "Leave empty to call as soon as it's booked.",
    consentLabel:
      "I confirm {name} is happy to receive a fun AI birthday call at this number.",
    disclosureTitle: "How it works",
    disclosure:
      "Our characters are original creations, and every call opens by saying it's an AI. We never impersonate real people or trademarked characters.",
    submit: "Continue to payment →",
    submitting: "Setting up…",
    redirecting: "Taking you to checkout…",
    bookedTitle: "Booked! 🎉",
    bookedBody: "Payment confirmed — {name} will get their birthday call.",
    bookedHome: "Back to the song",
    errName: "Add the birthday person's name.",
    errPhone: "Enter a valid phone number in international format (e.g. +15551234567).",
    errConsent: "Please confirm they're happy to receive the call.",
    errPickCharacter: "Pick a character first.",
    errGeneric: "Couldn't set that up — please try again.",
    errNetwork: "Network hiccup — try again.",
    characters: {
      zoltar: {
        tagline:
          "A smooth FM radio host who sends a live on-air birthday dedication out just for them.",
      },
      pearl: {
        tagline: "A kind, sparkly fairy godmother who rings to grant a birthday wish.",
      },
      "captain-vero": {
        tagline: "A playful, big-hearted pirate captain calling to celebrate their special day.",
      },
    },
  },
  // Spoken call content (composeGreeting + persona directive). {character}/{name}/
  // {note} are filled at call time. `disclosure` MUST open the call — legal.
  castCall: {
    disclosure:
      "Hello! This is {character} — an AI birthday character calling with a special message just for you.",
    greet: "Happy birthday, {name}!",
    noteIntro: "Someone who loves you wanted me to say: {note}",
    speak: "Speak entirely in English, warmly and naturally, and stay in character.",
    callback: "If you'd like to reach the person who arranged this call, you can call {number}.",
  },
  // The Live cast — request a real, in-person performer (concierge pilot). Not
  // AI. {city}/{deposit}/{name} are filled at render time.
  castLive: {
    ctaTitle: "Bring a real performer to the party 🎸",
    ctaSubtitle:
      "Request a live musician or a costumed character to show up in person for {name}'s birthday.",
    pilotBadge: "Limited pilot — {city} only",
    open: "Request a live performer",
    close: "Maybe later",
    humanTitle: "A real human, not AI",
    human:
      "This is an in-person visit by a real performer we book for you — not an AI. We'll contact you to confirm every detail before anything is finalized.",
    chooseKind: "What would you like?",
    kindMusician: "🎸 Live musician",
    kindVisit: "🎭 Character visit",
    recipientNameLabel: "Who's the celebration for?",
    recipientNamePlaceholder: "Birthday person's name",
    cityLabel: "City",
    eventDateLabel: "Event date",
    addressLabel: "Where's the party? (optional)",
    addressPlaceholder: "Venue or neighborhood — we'll confirm the exact address",
    noteLabel: "Anything we should know? (optional)",
    notePlaceholder: "Song requests, the vibe, a detail to mention…",
    contactHeading: "How can we reach you to confirm?",
    contactPhoneLabel: "Your phone",
    contactPhonePlaceholder: "e.g. +1 555 123 4567",
    contactEmailLabel: "Your email",
    contactEmailPlaceholder: "you@example.com",
    consentLabel:
      "I understand this is a request for an in-person performer, and I'm happy to be contacted to arrange it.",
    depositNote: "A {deposit} deposit reserves your request; we confirm the details before anything else.",
    submit: "Request & pay deposit →",
    submitting: "Setting up…",
    errName: "Add the birthday person's name.",
    errCity: "Choose a pilot city.",
    errDate: "Pick a valid event date.",
    errContact: "Add a phone or email so we can reach you.",
    errConsent: "Please confirm you're happy to be contacted.",
    errGeneric: "Couldn't set that up — please try again.",
    errNetwork: "Network hiccup — try again.",
  },
  groupPay: {
    title: "Chip in together 🎁",
    subtitle:
      "Pitch in with friends to unlock {name}'s birthday song — everyone covers a little.",
    progress: "{paid} of {total}",
    friendsOne: "{count} friend chipped in",
    friendsMany: "{count} friends chipped in",
    noneYet: "Be the first to chip in",
    remaining: "{amount} to go",
    funded: "Fully funded — the song is unlocked! 🎉",
    open: "Chip in",
    close: "Maybe later",
    amountLabel: "Your amount (USD)",
    coverRest: "Cover the rest · {amount}",
    submit: "Chip in {amount} →",
    submitting: "Setting up…",
    errAmount: "Enter at least {min}.",
    errGeneric: "Couldn't set that up — please try again.",
    errNetwork: "Network hiccup — try again.",
  },
};

export type Dict = typeof en;
