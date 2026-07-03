import type { Dict } from "./en";

// Spanish — natural, native phrasing (not a literal translation).
export const es: Dict = {
  nav: {
    mySongs: "Mis canciones",
  },
  hero: {
    title: "Canciones de cumpleaños personalizadas para quienes más quieres.",
    subtitle: "Para quienes más quieres. En cualquier idioma. En menos de un minuto.",
    cta: "Crea una canción de cumpleaños gratis",
    freeNote: "Gratis · sin registro",
  },
  how: {
    title: "Cómo funciona",
    step1: "Cuéntanos sobre esa persona",
    step2: "Creamos la canción",
    step3: "Comparte la alegría",
  },
  footer: {
    madeWith: "Hecho con cariño por Sing My Birthday",
    venuePrompt: "¿Tienes un local o espacio para eventos?",
    venueLink: "Para locales →",
  },
  faq: {
    title: "Preguntas frecuentes",
    items: [
      {
        q: "¿Es gratis probarlo?",
        a: "Sí. Crear la canción y escuchar la vista previa de los primeros 15 segundos es totalmente gratis. Solo pagas para desbloquear y descargar la canción completa.",
      },
      {
        q: "¿Cuánto tarda?",
        a: "Alrededor de un minuto. Cuéntanos algunos detalles y tu canción personalizada se escribe y se canta automáticamente.",
      },
      {
        q: "¿Qué incluye?",
        a: "La canción completa, una descarga en MP3 para conservarla siempre y un vídeo para compartir en WhatsApp, Telegram y redes sociales. Deluxe añade además un vídeo de fotos al ritmo de la música.",
      },
      {
        q: "¿Qué idiomas admiten?",
        a: "Cualquier idioma: admitimos más de 7 y seguimos sumando, incluidos español, inglés y turco. Solo elige el que quieras al crear la canción.",
      },
      {
        q: "¿La canción es realmente mía para compartir y usar?",
        a: "Sí. Una vez la desbloqueas, la canción es tuya para reproducir, descargar, compartir y enviar a familia y amigos como prefieras.",
      },
      {
        q: "¿Y si no me convence?",
        a: "Respaldamos cada canción con una garantía de devolución. Si no quedas satisfecho, dínoslo y lo solucionamos.",
      },
      {
        q: "¿Esto es IA?",
        a: "Sí, funciona con IA y tú la guías. Tú eliges el nombre, los detalles y el estilo, y nuestra IA escribe y canta una canción única solo para esa persona.",
      },
    ],
  },
  generate: {
    nameLabel: "👤 ¿Quién es el cumpleañero?",
    namePlaceholder: "Escribe su nombre...",
    ageLabel: "🎂 ¿Cuántos años cumple?",
    agePlaceholder: "p. ej., 25",
    languageLabel: "🌍 Elige el idioma",
    genreLabel: "🎵 Elige un género",
    emailLabel: "📬 ¿A dónde enviamos la canción?",
    emailPlaceholder: "tu@ejemplo.com",
    emailHint: "Así podemos guardar tu canción.",
    attestationAdult: "Soy mayor de 18 años.",
    attestationGuardianPrefix:
      "Soy mayor de 18 años y soy el padre, la madre o el tutor legal de ",
    attestationGuardianFallback: "este niño o niña",
    marketingConsent:
      "Quiero recibir un recordatorio de cumpleaños el próximo año y ofertas ocasionales. (Opcional)",
    writeLyrics: "✨ Escribir la letra",
    writingLyrics: "Escribiendo la letra...",
    generateMusic: "🎵 Crear la música con esta letra",
    generatingMusic: "Creando la música...",
    rewriteLyrics: "✍️ Reescribir la letra",
    rewriting: "Escribiendo...",
    missingAddName: "Añade su nombre",
    missingAge: "Dinos cuántos años cumple",
    missingGenre: "Elige un género",
    missingWriteLyricsFirst: "Primero escribe la letra",
    missingAddEmail: "Añade tu correo para crear la canción",
    missingEmailFormat: "Revisa el formato del correo",
    missingGuardian: "Confirma que eres el padre, la madre o el tutor legal",
    missingTickBox: "Marca la casilla para continuar",
    waitReady: "¡Listo! 🎉",
    waitSongReady: "Tu canción está lista",
    waitAboutAMinute: "Tu canción estará lista en aproximadamente un minuto",
    waitAlmostThere: "Ya casi…",
    waitWritingSong: "Creando tu canción",
    commitmentHint:
      "¿Te gusta la letra? Crea la canción. Puedes reescribir la letra y volver a intentarlo todas las veces que quieras antes de hacerlo.",
    // Guided-flow step labels (progress header)
    stepDetails: "Sobre ellos",
    stepLyrics: "Letra",
    stepSong: "Canción",
    trustFreePreview: "✓ Vista previa gratis",
    trustNoSignup: "sin registro para empezar",
    trustMoneyBack: "💯 garantía de devolución",
    trustSecureStripe: "🔒 pago seguro con Stripe",
    trustRewriteFree:
      "Una canción completa y real en aproximadamente un minuto. ¿No te convence la letra? Reescríbela gratis, las veces que quieras.",
  },
  paywall: {
    previewLabelPrefix: "🎁 Vista previa gratis · primeros ",
    previewLabelSuffix: " segundos",
    unlockHeadlinePrefix: "Desbloquea la canción completa de ",
    unlockHeadlineSuffix: " 🎶",
    unlockHeadlineLovedPrefix: "¿Te encantó? Desbloquea la canción completa de ",
    standard: "Estándar",
    deluxe: "Deluxe",
    bestValue: "Mejor opción",
    bulletCompleteSong: "La canción completa (versión íntegra)",
    bulletMp3: "Descarga en MP3 — tuya para siempre",
    bulletShareVideo: "Un vídeo para compartir en WhatsApp y Telegram",
    bulletReplay: "Vuelve a escucharla y reenvíala a la familia cuando quieras",
    bulletEverythingStandard: "Todo lo del plan Estándar",
    bulletSlideshow: "Vídeo de fotos al ritmo de la música",
    unlockDeluxePrefix: "Desbloquear Deluxe",
    unlockStandardPrefix: "Desbloquear Estándar",
    openingCheckout: "Abriendo el pago seguro…",
    preparingSong: "Preparando tu canción…",
    moneyBack: "Te encanta o te devolvemos el dinero",
    secureCheckout: "Pago único · desbloqueo al instante · pago seguro con Stripe",
  },
};
