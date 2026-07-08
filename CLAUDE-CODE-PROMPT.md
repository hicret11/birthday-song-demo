# Промпт для Claude Code — Фаза 1: интеграция премьеры + признание отправителя

Скопируй всё, что ниже разделителя, и вставь в Claude Code (`claude`) в корне
репозитория `birthday-song-demo`.

---

Ты работаешь в проекте **Sing My Birthday** (Next.js 16, React 19, TypeScript,
Tailwind 4). Мы перестраиваем продукт из «генератора песен» в **личную
постановку дня рождения**: отправитель — режиссёр, именинник — звезда. Полный
контекст: файлы `ARCHITECTURE-AND-BUILD-PLAN.md`, `FLOW-REDESIGN.md`,
`reimagined-flow-prototype.html` в корне. Прочитай их перед началом.

## Что уже готово (не переделывай, используй)
- `components/premiere/PremiereReveal.tsx` — готовый театральный reveal-компонент
  (занавес, аудио-реактивный эквалайзер на Web Audio `AnalyserNode` + Canvas,
  конфетти, титр «Продюсер вечера — {director}»). Пропсы:
  `recipientName`, `directorName?`, `audioSrc?`, `songTitle?`, `continueLabel?`,
  `onContinue?`. Без внешних зависимостей.
- `app/premiere/page.tsx` + `app/premiere/PremiereClient.tsx` — превью-роут
  (оставь как есть, это review-поверхность).

## Задача (Фаза 1, продолжение)
1. **Вписать `PremiereReveal` в реальный reveal-момент** в
   `app/generate/GeneratorClient.tsx`. Сейчас шаг вычисляется как
   `const step = audioUrl ? 3 : lyrics ? 2 : 1;` — Шаг 3 это готовая песня
   (reveal + превью + paywall). Замени плоский reveal песни на премьеру:
   - `recipientName` = имя из состояния формы.
   - `audioSrc` = аудио сгенерированной песни, обёрнутое в **`toAudioProxyUrl`**
     (тот же same-origin proxy, что использует `components/share/templates/shared.tsx`),
     иначе `AnalyserNode` не прочитает данные с cross-origin Blob и эквалайзер не
     оживёт.
   - `songTitle` = `lyrics.title`, если есть.
   - `directorName` = имя/связь отправителя (см. п.2).
   - `onContinue` = переход к текущему share/отправке.
   - **Не ломай paywall**: заблокированная песня на публичной странице шара
     по-прежнему отдаёт только 15-сек превью (`toPublicSong` + `/api/share/[id]/preview`).
     Премьера в генераторе — для создателя (у него есть полное аудио); проверь,
     что это разграничение сохранено.
2. **Признание отправителя (dual feel-special).** В флоу уже есть состояние
   `relationship` (см. `GeneratorClient.tsx`). Добавь тёплый шаг/поле «А кто ты
   для них?» (мама, лучший друг, партнёр…) в начале и прокинь его как
   `directorName` в премьеру. Никакой «формы» — копирайт от первого лица.
3. **i18n.** Любой новый текст добавь во ВСЕ словари `lib/i18n/dictionaries/*.ts`
   (en, es, tr, ar и остальные — не хардкодь строки в компоненте флоу).

## Ограничения
- Единый **TypeScript**, без новых языков. Новые npm-зависимости не добавляй без
  необходимости (GSAP разрешён, если CSS реально не хватает — но премьера уже
  работает без него).
- Мобайл 60fps: анимируй только `transform`/`opacity`; уважай
  `prefers-reduced-motion` (в компоненте уже учтено — не сломай).
- Ничего не коммить в `main`; работай в ветке `feat/phase-1-premiere`.

## Критерии приёмки (обязательно прогони и покажи вывод)
- `npx tsc --noEmit` — без ошибок.
- `npx eslint app/generate/GeneratorClient.tsx components/premiere/*.tsx` — чисто.
- `npm run dev` → открой `/generate`, пройди флоу до готовой песни → должна
  показаться премьера с занавесом и живым эквалайзером под реальный трек.
- Заблокированный публичный шар всё ещё отдаёт только превью (paywall не сломан).

Начни с чтения `GeneratorClient.tsx` вокруг вычисления `step` и текущего reveal
Шага 3, затем предложи план правок, затем реализуй.
