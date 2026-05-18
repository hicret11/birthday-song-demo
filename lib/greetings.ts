// Localized birthday greetings for the share-video overlay.
// Latin-script languages (English, Spanish, French, Turkish) render with the
// bundled Inter/PlayfairDisplay fonts. Arabic, Hindi, Russian translations
// are included but will show placeholder glyphs until Noto fonts ship —
// fallback path returns the English greeting to keep the overlay readable.

const GREETINGS: Record<string, (name: string) => string> = {
  English: (name) => `Happy Birthday, ${name}!`,
  Spanish: (name) => `¡Feliz Cumpleaños, ${name}!`,
  French: (name) => `Joyeux Anniversaire, ${name}!`,
  Turkish: (name) => `Doğum Günün Kutlu Olsun, ${name}!`,
  Arabic: (name) => `عيد ميلاد سعيد، ${name}!`,
  Hindi: (name) => `जन्मदिन मुबारक हो, ${name}!`,
  Russian: (name) => `С Днём Рождения, ${name}!`,
};

export function greetingFor(language: string, name: string): string {
  const formatter = GREETINGS[language];
  return formatter ? formatter(name) : GREETINGS.English(name);
}
