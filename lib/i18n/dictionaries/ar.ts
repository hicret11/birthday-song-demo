import type { Dict } from "./en";

// Arabic (Modern Standard Arabic) — natural, native phrasing (RTL).
export const ar: Dict = {
  nav: {
    mySongs: "أغانيي",
  },
  hero: {
    title: "أغاني عيد ميلاد مخصّصة، مصنوعة لمن تحب.",
    subtitle: "لمن تحب. بأي لغة. في غضون دقيقة تقريبًا.",
    cta: "أنشئ أغنية عيد ميلاد مجانية",
    freeNote: "مجانًا · بدون تسجيل",
  },
  how: {
    title: "كيف يعمل",
    step1: "أخبرنا عنهم",
    step2: "نحن نصنع الأغنية",
    step3: "أرسل الفرحة",
  },
  footer: {
    madeWith: "صُنع بحب من Sing My Birthday",
    venuePrompt: "هل تملك قاعة أو مساحة للفعاليات؟",
    venueLink: "للقاعات ←",
  },
  faq: {
    title: "الأسئلة الشائعة",
    items: [
      {
        q: "هل التجربة مجانية؟",
        a: "نعم. إنشاء الأغنية والاستماع إلى المقطع التجريبي الأول الذي يدوم 15 ثانية مجاني تمامًا. لا تدفع إلا لفتح الأغنية كاملة وتنزيلها.",
      },
      {
        q: "كم يستغرق الأمر؟",
        a: "دقيقة تقريبًا. أخبرنا ببعض التفاصيل، وتُكتب أغنيتك المخصّصة وتُغنّى تلقائيًا.",
      },
      {
        q: "ماذا أحصل عليه؟",
        a: "الأغنية كاملة، وملف MP3 لتنزيله والاحتفاظ به إلى الأبد، ومقطع فيديو قابل للمشاركة على واتساب وتيليجرام ومنصات التواصل. كما تضيف باقة ديلوكس عرض شرائح من الصور مصحوبًا بالموسيقى.",
      },
      {
        q: "ما اللغات التي تدعمونها؟",
        a: "أي لغة — ندعم أكثر من 7 لغات والقائمة تنمو، بما في ذلك الإنجليزية والإسبانية والتركية. ما عليك سوى اختيار اللغة التي تريدها عند إنشاء الأغنية.",
      },
      {
        q: "هل الأغنية مِلكي حقًا لأشاركها وأستخدمها؟",
        a: "نعم. بمجرد فتحها، تصبح الأغنية ملكك لتشغيلها وتنزيلها ومشاركتها وإرسالها للعائلة والأصدقاء كما تشاء.",
      },
      {
        q: "ماذا لو لم تعجبني؟",
        a: "ندعم كل أغنية بضمان استرداد الأموال. إذا لم تكن راضيًا، أخبرنا وسنصلح الأمر.",
      },
      {
        q: "هل هذا ذكاء اصطناعي؟",
        a: "نعم — إنه مدعوم بالذكاء الاصطناعي، وأنت توجّهه. تختار الاسم والتفاصيل والأسلوب، ثم يكتب الذكاء الاصطناعي ويغني أغنية فريدة من نوعها خصيصًا لهم.",
      },
    ],
  },
  generate: {
    // Form field labels / placeholders (conversion path)
    nameLabel: "👤 من نجم عيد الميلاد؟",
    namePlaceholder: "أدخل اسمهم...",
    ageLabel: "🎂 كم عمرهم؟",
    agePlaceholder: "مثال: 25",
    languageLabel: "🌍 اختر اللغة",
    genreLabel: "🎵 اختر نوع الموسيقى",
    emailLabel: "📬 إلى أين نرسل الأغنية؟",
    emailPlaceholder: "you@example.com",
    emailHint: "حتى نتمكن من حفظ أغنيتك.",
    attestationAdult: "عمري 18 عامًا أو أكثر.",
    // {name} interpolated by the caller
    attestationGuardianPrefix: "عمري 18 عامًا أو أكثر وأنا والد أو الوصي القانوني على ",
    attestationGuardianFallback: "هذا الطفل",
    marketingConsent:
      "أرسل لي تذكيرًا بعيد الميلاد العام المقبل وعروضًا من حين لآخر. (اختياري)",
    // Primary CTAs
    writeLyrics: "✨ اكتب الكلمات",
    writingLyrics: "جارٍ كتابة الكلمات...",
    generateMusic: "🎵 أنشئ الموسيقى بهذه الكلمات",
    generatingMusic: "جارٍ إنشاء الموسيقى...",
    rewriteLyrics: "✍️ أعد كتابة الكلمات",
    rewriting: "جارٍ الكتابة...",
    // Gating hint strings (missingForLyrics / missingForMusic)
    missingAddName: "أضف اسمهم",
    missingAge: "أخبرنا بكم سيبلغون من العمر",
    missingGenre: "اختر نوع الموسيقى",
    missingWriteLyricsFirst: "اكتب الكلمات أولًا",
    missingAddEmail: "أضف بريدك الإلكتروني لإنشاء الأغنية",
    missingEmailFormat: "تحقّق من صيغة البريد الإلكتروني",
    missingGuardian: "أكّد أنك الوالد أو الوصي القانوني",
    missingTickBox: "ضع علامة في المربع للمتابعة",
    // Wait-state / loading lines
    waitReady: "تم! 🎉",
    waitSongReady: "أغنيتك جاهزة",
    waitAboutAMinute: "ستكون أغنيتك جاهزة في غضون دقيقة تقريبًا",
    waitAlmostThere: "أوشكنا على الانتهاء…",
    waitWritingSong: "جارٍ كتابة أغنيتك",
    commitmentHint:
      "هل أعجبتك الكلمات؟ أنشئ الأغنية. يمكنك إعادة كتابة الكلمات والمحاولة مجددًا بقدر ما تريد قبل ذلك.",
    // Guided-flow step labels (progress header)
    stepDetails: "عنهم",
    stepLyrics: "الكلمات",
    stepSong: "الأغنية",
    // Trust strip
    trustFreePreview: "✓ معاينة مجانية",
    trustNoSignup: "بدون تسجيل للبدء",
    trustMoneyBack: "💯 ضمان استرداد الأموال",
    trustSecureStripe: "🔒 دفع آمن عبر Stripe",
    trustRewriteFree:
      "أغنية حقيقية كاملة في غضون دقيقة تقريبًا — لم تعجبك الكلمات؟ أعد كتابتها مجانًا، بقدر ما تريد.",
  },
  paywall: {
    // Preview label ({seconds} interpolated by caller)
    previewLabelPrefix: "🎁 معاينة مجانية · أول ",
    previewLabelSuffix: " ثانية",
    // Unlock headline ({name} interpolated by caller)
    unlockHeadlinePrefix: "افتح أغنية ",
    unlockHeadlineSuffix: " كاملة 🎶",
    unlockHeadlineLovedPrefix: "أعجبتك؟ افتح أغنية ",
    // Plan names
    standard: "عادية",
    deluxe: "ديلوكس",
    bestValue: "أفضل قيمة",
    // Value-stack bullets
    bulletCompleteSong: "الأغنية كاملة (النسخة الكاملة)",
    bulletMp3: "تنزيل MP3 — احتفظ به إلى الأبد",
    bulletShareVideo: "فيديو قابل للمشاركة على واتساب وتيليجرام",
    bulletReplay: "أعد التشغيل وأعد الإرسال للعائلة في أي وقت",
    bulletEverythingStandard: "كل ما في الباقة العادية",
    bulletSlideshow: "فيديو عرض شرائح من الصور مصحوب بالموسيقى",
    // CTAs ({price} interpolated by caller)
    unlockDeluxePrefix: "افتح ديلوكس",
    unlockStandardPrefix: "افتح العادية",
    openingCheckout: "جارٍ فتح الدفع الآمن…",
    preparingSong: "جارٍ تحضير أغنيتك…",
    moneyBack: "أحببها أو استرد أموالك",
    secureCheckout: "دفعة واحدة · فتح فوري · دفع آمن عبر Stripe",
  },
};
