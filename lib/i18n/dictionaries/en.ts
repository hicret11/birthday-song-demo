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
  },
  paywall: {
    // Preview label ({seconds} interpolated by caller)
    previewLabelPrefix: "🎁 Free preview · first ",
    previewLabelSuffix: " seconds",
    // Unlock headline ({name} interpolated by caller)
    unlockHeadlinePrefix: "Unlock ",
    unlockHeadlineSuffix: "’s full song 🎶",
    unlockHeadlineLovedPrefix: "Loved it? Unlock ",
    // Plan names
    standard: "Standard",
    deluxe: "Deluxe",
    bestValue: "Best value",
    // Value-stack bullets
    bulletCompleteSong: "The complete song (full version)",
    bulletMp3: "MP3 download — keep it forever",
    bulletShareVideo: "A shareable video for WhatsApp & Telegram",
    bulletReplay: "Replay & re-send to family anytime",
    bulletEverythingStandard: "Everything in Standard",
    bulletSlideshow: "Photo slideshow video set to the music",
    // CTAs ({price} interpolated by caller)
    unlockDeluxePrefix: "Unlock Deluxe",
    unlockStandardPrefix: "Unlock Standard",
    openingCheckout: "Opening secure checkout…",
    preparingSong: "Preparing your song…",
    moneyBack: "Love it or your money back",
    secureCheckout: "One-time payment · instant unlock · secure checkout by Stripe",
  },
};

export type Dict = typeof en;
