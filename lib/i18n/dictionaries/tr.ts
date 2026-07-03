import type { Dict } from "./en";

// Turkish — natural, native phrasing (not a literal translation).
export const tr: Dict = {
  nav: {
    mySongs: "Şarkılarım",
  },
  hero: {
    title: "Sevdikleriniz için kişiye özel doğum günü şarkıları.",
    subtitle: "Sevdikleriniz için. Her dilde. Yaklaşık bir dakikada.",
    cta: "Ücretsiz doğum günü şarkısı oluştur",
    freeNote: "Ücretsiz · kayıt yok",
  },
  how: {
    title: "Nasıl çalışır",
    step1: "Bize ondan bahsedin",
    step2: "Şarkıyı biz hazırlayalım",
    step3: "Mutluluğu paylaşın",
  },
  footer: {
    madeWith: "Sing My Birthday tarafından sevgiyle yapıldı",
    venuePrompt: "Bir mekânınız veya etkinlik alanınız mı var?",
    venueLink: "Mekânlar için →",
  },
  faq: {
    title: "Sıkça sorulan sorular",
    items: [
      {
        q: "Denemesi ücretsiz mi?",
        a: "Evet. Şarkı oluşturmak ve ilk 15 saniyelik önizlemeyi dinlemek tamamen ücretsizdir. Yalnızca şarkının tamamını açmak ve indirmek için ödeme yaparsınız.",
      },
      {
        q: "Ne kadar sürer?",
        a: "Yaklaşık bir dakika. Birkaç ayrıntı verin, kişiye özel şarkınız otomatik olarak yazılıp söylensin.",
      },
      {
        q: "Neler alıyorum?",
        a: "Şarkının tamamı, sonsuza dek saklayabileceğiniz bir MP3 indirme ve WhatsApp, Telegram ile sosyal medya için paylaşılabilir bir video. Deluxe ayrıca müziğe uyarlanmış bir fotoğraf slayt gösterisi de ekler.",
      },
      {
        q: "Hangi dilleri destekliyorsunuz?",
        a: "Her dili: Türkçe, İngilizce ve İspanyolca dahil 7'den fazla dili destekliyoruz ve sayı artıyor. Şarkıyı oluştururken istediğiniz dili seçmeniz yeterli.",
      },
      {
        q: "Şarkı gerçekten paylaşıp kullanmam için benim mi?",
        a: "Evet. Şarkının kilidini açtığınızda; çalmak, indirmek, paylaşmak ve ailenize, arkadaşlarınıza dilediğiniz gibi göndermek için şarkı sizindir.",
      },
      {
        q: "Beğenmezsem ne olur?",
        a: "Her şarkıyı para iade garantisiyle destekliyoruz. Memnun kalmazsanız bize bildirin, sorunu çözelim.",
      },
      {
        q: "Bu yapay zekâ mı?",
        a: "Evet, yapay zekâ destekli ve yönlendiren sizsiniz. Adı, ayrıntıları ve tarzı siz seçersiniz; yapay zekâmız da yalnızca o kişiye özel, eşsiz bir şarkı yazıp söyler.",
      },
    ],
  },
  generate: {
    nameLabel: "👤 Doğum günü yıldızı kim?",
    namePlaceholder: "Adını yazın...",
    ageLabel: "🎂 Kaç yaşına giriyor?",
    agePlaceholder: "örn. 25",
    languageLabel: "🌍 Dil seçin",
    genreLabel: "🎵 Bir tür seçin",
    emailLabel: "📬 Şarkıyı nereye gönderelim?",
    emailPlaceholder: "siz@ornek.com",
    emailHint: "Böylece şarkınızı kaydedebiliriz.",
    attestationAdult: "18 yaşından büyüğüm.",
    attestationGuardianPrefix:
      "18 yaşından büyüğüm ve şu kişinin ebeveyni veya yasal vasisiyim: ",
    attestationGuardianFallback: "bu çocuk",
    marketingConsent:
      "Gelecek yıl bana doğum günü hatırlatması ve ara sıra fırsatlar gönderin. (İsteğe bağlı)",
    writeLyrics: "✨ Sözleri Yaz",
    writingLyrics: "Sözler yazılıyor...",
    generateMusic: "🎵 Bu sözlerle müziği oluştur",
    generatingMusic: "Müzik oluşturuluyor...",
    rewriteLyrics: "✍️ Sözleri yeniden yaz",
    rewriting: "Yazılıyor...",
    missingAddName: "Adını ekleyin",
    missingAge: "Kaç yaşına girdiğini söyleyin",
    missingGenre: "Bir tür seçin",
    missingWriteLyricsFirst: "Önce sözleri yazın",
    missingAddEmail: "Şarkıyı oluşturmak için e-postanızı ekleyin",
    missingEmailFormat: "E-posta biçimini kontrol edin",
    missingGuardian: "Ebeveyn veya yasal vasi olduğunuzu onaylayın",
    missingTickBox: "Devam etmek için kutuyu işaretleyin",
    waitReady: "Hazır! 🎉",
    waitSongReady: "Şarkınız hazır",
    waitAboutAMinute: "Şarkınız yaklaşık bir dakika içinde hazır olacak",
    waitAlmostThere: "Neredeyse bitti…",
    waitWritingSong: "Şarkınız yazılıyor",
    commitmentHint:
      "Sözleri beğendiniz mi? Şarkıyı oluşturun. Oluşturmadan önce sözleri istediğiniz kadar yeniden yazıp tekrar deneyebilirsiniz.",
    // Guided-flow step labels (progress header)
    stepDetails: "Kişi hakkında",
    stepLyrics: "Sözler",
    stepSong: "Şarkı",
    trustFreePreview: "✓ Ücretsiz önizleme",
    trustNoSignup: "başlamak için kayıt yok",
    trustMoneyBack: "💯 para iade garantisi",
    trustSecureStripe: "🔒 Stripe ile güvenli ödeme",
    trustRewriteFree:
      "Yaklaşık bir dakikada gerçek, tam bir şarkı. Sözleri beğenmediniz mi? İstediğiniz kadar ücretsiz yeniden yazdırın.",
  },
  paywall: {
    previewLabelPrefix: "🎁 Ücretsiz önizleme · ilk ",
    previewLabelSuffix: " saniye",
    unlockHeadlinePrefix: "",
    unlockHeadlineSuffix: " için şarkının tamamını açın 🎶",
    unlockHeadlineLovedPrefix: "Beğendiniz mi? ",
    standard: "Standart",
    deluxe: "Deluxe",
    bestValue: "En iyi değer",
    bulletCompleteSong: "Şarkının tamamı (tam sürüm)",
    bulletMp3: "MP3 indirme — sonsuza dek sizin",
    bulletShareVideo: "WhatsApp ve Telegram için paylaşılabilir video",
    bulletReplay: "İstediğiniz zaman tekrar dinleyin ve aileye yeniden gönderin",
    bulletEverythingStandard: "Standart paketteki her şey",
    bulletSlideshow: "Müziğe uyarlanmış fotoğraf slayt gösterisi videosu",
    unlockDeluxePrefix: "Deluxe'ü Aç",
    unlockStandardPrefix: "Standart'ı Aç",
    openingCheckout: "Güvenli ödeme açılıyor…",
    preparingSong: "Şarkınız hazırlanıyor…",
    moneyBack: "Beğenin ya da paranızı geri alın",
    secureCheckout: "Tek seferlik ödeme · anında erişim · Stripe ile güvenli ödeme",
  },
};
