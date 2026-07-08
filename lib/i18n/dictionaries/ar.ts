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
    // تقدير المُرسِل — خطوة دافئة: «ومن أنت له/لها؟».
    relationshipLabel: "ومن أنت له؟",
    relationshipOptional: "(اختياري)",
    relationshipHint: "سيظهر هذا كتوقيعك كمنتج في العرض الأول.",
    relationshipFriend: "صديقه",
    relationshipPartner: "شريكه",
    relationshipFamily: "من عائلته",
    relationshipColleague: "زميله",
    relationshipOther: "شخص يحبّه",
  },
  paywall: {
    // Preview label — the 15s cap framed as the opening/trailer of the show.
    previewLabelPrefix: "🎬 هذه بداية عرضه الأول — ",
    previewLabelSuffix: "افتح القفل لرفع الستار عن العرض كاملًا",
    // Unlock headline ({name} interpolated by caller)
    unlockHeadlinePrefix: "ارفع الستار عن عرض ",
    unlockHeadlineSuffix: " الأول كاملًا 🎬",
    unlockHeadlineLovedPrefix: "كانت تلك البداية فقط. ",
    // Plan names
    standard: "عادية",
    deluxe: "ديلوكس",
    bestValue: "أفضل قيمة",
    // Value-stack bullets
    bulletCompleteSong: "العرض الأول كاملًا — الأغنية بالكامل",
    bulletMp3: "تنزيل MP3 — احتفظ به إلى الأبد",
    bulletShareVideo: "فيديو قابل للمشاركة على واتساب وتيليجرام",
    bulletReplay: "أعد التشغيل وأعد الإرسال للعائلة في أي وقت",
    bulletEverythingStandard: "كل ما في الباقة العادية",
    bulletSlideshow: "فيديو عرض شرائح من الصور مصحوب بالموسيقى",
    // CTAs ({price} interpolated by caller)
    unlockDeluxePrefix: "ارفع الستار · ديلوكس",
    unlockStandardPrefix: "ارفع الستار · العادية",
    openingCheckout: "جارٍ فتح الدفع الآمن…",
    preparingSong: "جارٍ تحضير العرض الأول…",
    moneyBack: "أحببها أو استرد أموالك",
    secureCheckout: "دفعة واحدة · فتح فوري · دفع آمن عبر Stripe",
  },
  // العرض الأول — الكشف المسرحي عن الأغنية المكتملة.
  premiere: {
    overline: "العرض الأول · ليلة الافتتاح",
    introPrefix: "عرض ",
    introSuffix: " الأول جاهز. خفّض الأضواء، ارفع الصوت — وابدأ بالمشهد الأول.",
    openCta: "🎬 ابدأ العرض الأول",
    marqueeOverline: "نجم هذه الليلة",
    pause: "⏸ إيقاف مؤقت",
    replay: "▶ تشغيل مرة أخرى",
    director: "من إنتاج",
    continueLabel: "أرسِلها إليه 💌",
  },
  // سحر المجموعة — ادعُ دائرة المحتفى به لكتابة أغنية واحدة معًا.
  crowd: {
    cta: "اجعلها أغنية جماعية 💛",
    ctaHint: "ادعُ دائرته لإضافة أبيات وذكريات — وسننسجها في أغنية واحدة.",
    creating: "جارٍ البدء…",
    linkHeading: "رابط أغنيتكم الجماعية جاهز 🎉",
    linkSubtitle: "شاركه مع دائرته — يمكن لكل شخص إضافة بيت أو ذكرى أو أمنية.",
    copy: "انسخ الرابط",
    copied: "تم النسخ ✓",
    share: "شارك الرابط",
    error: "تعذّر بدء الأغنية الجماعية. حاول مرة أخرى.",
    // العرض الأول الجماعي في صفحة المشاركة.
    premiereOverlinePrefix: "أغنية من ",
    premiereOverlineSuffix: " أشخاص يحبّونك",
    premiereOverlineSolo: "أغنية صُنعت بحبّ",
    withLove: "بحبّ من",
  },
  // صفحة المساهم (/join) — حيث تضيف دائرة صاحب العيد لمستها.
  crowdContributor: {
    metaTitle: "أضِف لمستك إلى أغنية عيد ميلاد {name}",
    metaDescription:
      "ساعد في صنع أغنية عيد ميلاد {name} — أضِف عبارة أو ذكرى أو أمنية. يتحول كل ذلك إلى أغنية واحدة.",
    overline: "أغنية عيد ميلاد جماعية",
    headingPrefix: "ساعد في جعل أغنية عيد ميلاد ",
    headingSuffix: " ساحرة",
    introLead: "شخص يحب ",
    introAfterName: " يصنع له أغنية، ويريد جزءًا ",
    you: "منك",
    introTail:
      " فيها. أضِف عبارة أو ذكرى أو أمنية. يتحول كل ذلك إلى أغنية واحدة سيسمعها في عيد ميلاده.",
    liveAdding: "أشخاص يضيفون الآن",
    countOne: "💛 أضاف {n} شخص مساهمته",
    countMany: "💛 أضاف {n} أشخاص مساهمتهم",
    kinds: {
      line: {
        label: "عبارة من الأغنية",
        placeholder: "عبارة للأغنية — نكتة خاصة، لقب، شيء لا يقوله سواك…",
      },
      memory: {
        label: "ذكرى",
        placeholder: "لحظة معه لن تنساها أبدًا…",
      },
      wish: {
        label: "أمنية",
        placeholder: "بماذا تتمنى له هذا العام؟",
      },
    },
    photoTab: "أضف صورة",
    voiceTab: "مقطع صوتي · قريبًا",
    voiceTitle: "المقاطع الصوتية قادمة قريبًا",
    photoPickPrompt: "اضغط لاختيار صورة تجمعكما",
    photoHint: "JPG وPNG وWebP · حتى ٦ ميغابايت",
    photoPreviewAlt: "معاينة صورتك",
    photoChange: "تغيير",
    namePlaceholder: "اسمك (اختياري — ليعرفوا أنها منك)",
    uploading: "جارٍ الرفع…",
    sending: "جارٍ الإرسال…",
    addAnother: "أضف أخرى 💛",
    submitPhoto: "أضف صورتي →",
    submitText: "أضِفها إلى الأغنية →",
    donePrefix: "✓ تمت الإضافة! أنت الآن جزء من أغنية ",
    doneSuffix: ".",
    circlePrefix: "ما يقوله أحبّاء ",
    circleSuffix: "",
    photoFromAlt: "صورة من {name}",
    photoAlt: "صورة للأغنية",
    photoCaption: "صورة",
    footer: "Sing My Birthday · كلماتك تصبح جزءًا من الأغنية",
    fallbackName: "الشخص",
    errNeedText: "اكتب بضع كلمات أولًا.",
    errNeedPhoto: "اختر صورة أولًا.",
    errNotImage: "لا يبدو أن هذا صورة — اختر صورة (JPG أو PNG أو WebP…).",
    errTooBig: "حجم الصورة يتجاوز ٦ ميغابايت — جرّب صورة أصغر.",
    errSend: "تعذّر الإرسال — حاول مرة أخرى.",
    errUpload: "تعذّر رفع الصورة — حاول مرة أخرى.",
    errAddPhoto: "تعذّرت إضافة الصورة — حاول مرة أخرى.",
    errNetwork: "خلل في الاتصال — حاول مرة أخرى.",
  },
  // الطاقم — احجز شخصية أصلية تتصل بصاحب العيد (مكالمة بصوت ذكاء اصطناعي).
  cast: {
    ctaTitle: "أرسِل له مكالمة عيد ميلاد ساحرة 📞",
    ctaSubtitle:
      "احجز شخصية أصلية تتصل بـ {name} وتهنئه بعيد ميلاده — بصوتها الخاص.",
    open: "احجز مكالمة شخصية",
    close: "ربما لاحقًا",
    pickCharacter: "اختر شخصيتك",
    from: "ابتداءً من",
    recipientNameLabel: "لمن المكالمة؟",
    recipientNamePlaceholder: "اسم صاحب العيد",
    phoneLabel: "رقم هاتفه",
    phonePlaceholder: "‎+20 100 123 4567",
    phoneHint: "بالصيغة الدولية، تبدأ بعلامة + ورمز الدولة.",
    noteLabel: "رسالة شخصية (اختياري)",
    notePlaceholder: "شيء تذكره الشخصية — نكتة خاصة، أمنية…",
    scheduleLabel: "متى نتصل؟ (اختياري)",
    scheduleHint: "اتركه فارغًا للاتصال فور الحجز.",
    consentLabel:
      "أؤكد أن {name} موافق على تلقّي مكالمة عيد ميلاد مرحة بالذكاء الاصطناعي على هذا الرقم.",
    disclosureTitle: "كيف تعمل",
    disclosure:
      "شخصياتنا إبداعات أصلية، وكل مكالمة تبدأ بالإفصاح عن أنها ذكاء اصطناعي. لا ننتحل أبدًا شخصيات أشخاص حقيقيين أو شخصيات ذات علامات تجارية.",
    submit: "المتابعة إلى الدفع →",
    submitting: "جارٍ الإعداد…",
    redirecting: "جارٍ نقلك إلى الدفع…",
    bookedTitle: "تم الحجز! 🎉",
    bookedBody: "تم تأكيد الدفع — سيتلقى {name} مكالمة عيد ميلاده.",
    bookedHome: "العودة إلى الأغنية",
    errName: "أضِف اسم صاحب العيد.",
    errPhone: "أدخل رقمًا صحيحًا بالصيغة الدولية (مثل +201001234567).",
    errConsent: "يرجى تأكيد موافقته على تلقّي المكالمة.",
    errPickCharacter: "اختر شخصية أولًا.",
    errGeneric: "تعذّر الإعداد — حاول مرة أخرى.",
    errNetwork: "خلل في الاتصال — حاول مرة أخرى.",
    characters: {
      zoltar: {
        tagline: "ساحر دافئ وطريف يتصل ليُلقي تعويذة حظٍّ سعيد بمناسبة عيد الميلاد.",
      },
      pearl: {
        tagline: "جنية عرّابة لطيفة ومتلألئة تتصل لتحقيق أمنية عيد ميلاد.",
      },
      "captain-vero": {
        tagline: "قبطان قراصنة مرح وطيّب القلب يتصل للاحتفال بيومه المميز.",
      },
    },
  },
  castCall: {
    disclosure:
      "مرحبًا! أنا {character} — شخصية عيد ميلاد بالذكاء الاصطناعي تتصل بك برسالة خاصة لك وحدك.",
    greet: "عيد ميلاد سعيد يا {name}!",
    noteIntro: "طلب مني شخص يحبك أن أقول لك: {note}",
    speak: "تحدّث بالعربية بالكامل، بدفء وعفوية، وابقَ ضمن الشخصية.",
  },
};
