# Chess Practice Overlay

Локальное Chrome Extension для анализа шахматных позиций и тренировки расчёта в шахматах на Chess.com.

Расширение:

- определяет доску Chess.com;
- читает текущую позицию из DOM;
- отслеживает ходы в реальном времени;
- поддерживает `chess.js`;
- запускает локальный Stockfish 18 через Web Worker;
- показывает лучший ход поверх доски;
- корректно работает при resize, scroll и flip board;
- имеет компактный popup с переключателем подсказок и глубиной Stockfish;
- предназначено для персонального использования и самообучения.

> **Важно:** Этот инструмент создан исключительно для образовательных целей и персонального интереса. 
> Использование engine assistance в рейтинговых играх против других игроков нарушает правила fair play 
> и может привести к бану аккаунта. Используйте ответственно и только в режимах, где это явно разрешено 
> правилами платформы.

---

## 1. Стек

- Chrome Extension Manifest V3
- TypeScript
- Vite
- React
- chess.js
- Stockfish 18 WASM
- Chrome Offscreen Document
- Web Worker
- SVG overlay

---

## 2. Требования

Перед запуском установите:

- Google Chrome
- Node.js 20+ рекомендуется
- npm
- Git — опционально
- VS Code — опционально

Проверить версии:

```bash
node -v
npm -v
```

---

## 3. Установка проекта

Клонируйте репозиторий:

```bash
git clone <YOUR_REPOSITORY_URL>
cd chess-practice-overlay
```

Если проект был передан архивом:

```bash
cd chess-practice-overlay
```

Установите зависимости:

```bash
npm install
```

Основные зависимости:

```bash
npm install chess.js stockfish react react-dom
```

Dev dependencies:

```bash
npm install -D \
  typescript \
  vite \
  @vitejs/plugin-react \
  @types/chrome \
  @types/react \
  @types/react-dom \
  @types/node
```

---

## 4. Stockfish

Проект использует локальный:

```text
stockfish 18
```

После:

```bash
npm install
```

проверьте файлы:

```bash
ls node_modules/stockfish/bin
```

Нужны:

```text
stockfish-18-lite-single.js
stockfish-18-lite-single.wasm
```

Проверка:

```bash
ls -lh node_modules/stockfish/bin/stockfish-18-lite-single*
```

Пример:

```text
stockfish-18-lite-single.js      ~21 KB
stockfish-18-lite-single.wasm    ~7 MB
```

Скопируйте их в extension assets:

```bash
mkdir -p public/engine
```

```bash
cp \
  node_modules/stockfish/bin/stockfish-18-lite-single.js \
  public/engine/
```

```bash
cp \
  node_modules/stockfish/bin/stockfish-18-lite-single.wasm \
  public/engine/
```

Проверьте:

```bash
ls -lh public/engine
```

Должно быть:

```text
public/engine/
├── stockfish-18-lite-single.js
└── stockfish-18-lite-single.wasm
```

---

## 5. Сборка

Проверка TypeScript:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

После успешной сборки появится:

```text
dist/
```

Проверьте Stockfish:

```bash
ls -lh dist/engine
```

Должны присутствовать:

```text
dist/engine/stockfish-18-lite-single.js
dist/engine/stockfish-18-lite-single.wasm
```

---

## 6. npm scripts

Рекомендуемые scripts в `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build:main": "vite build",
    "build:content": "vite build --config vite.content.config.ts",
    "build": "npm run typecheck && npm run build:main && npm run build:content",
    "clean": "rm -rf dist"
  }
}
```

Полная пересборка:

```bash
npm run clean
npm run build
```

---

## 7. Установка extension в Chrome

Откройте:

```text
chrome://extensions
```

Далее:

1. Включите **Developer mode**.
2. Нажмите **Load unpacked**.
3. Выберите папку:

```text
chess-practice-overlay/dist
```

Не выбирайте корень проекта.

Нужно выбирать именно:

```text
dist
```

После загрузки появится:

```text
Chess Practice Overlay
```

---

## 8. После изменения кода

Каждый раз после изменений:

```bash
npm run build
```

Затем:

```text
chrome://extensions
```

Нажмите:

```text
Reload
```

у расширения.

После этого обновите Chess.com:

```text
Cmd + Shift + R
```

на macOS.

Windows/Linux:

```text
Ctrl + Shift + R
```

---

## 9. Запуск на Chess.com

Основной тестовый URL:

```text
https://www.chess.com/play/computer
```

Также возможны URL вида:

```text
https://www.chess.com/play/computer/Cliff-BOT
```

Начните **новую стандартную игру** против бота.

При нормальном запуске в Console должны появиться сообщения примерно:

```text
[Chess Practice Overlay] content script loaded
[Chess Practice Overlay] detected pathname=/play/computer/...
[Chess Practice Overlay] detected mode=BOT
[Chess Practice Overlay] board detected pieces=32
[Chess Practice Overlay] initialPositionStandard=true
[Chess Practice Overlay] BoardOverlay mounted
[Chess Practice Overlay] PositionObserver started
[Chess Practice Overlay] session started mode=BOT ...
```

---

## 10. Как работает проект

Общий pipeline:

```text
Chess.com DOM
    ↓
Board Detector
    ↓
Piece Parser
    ↓
Position Snapshot
    ↓
MutationObserver
    ↓
chess.js
    ↓
Confirmed Move
    ↓
Analysis Controller
    ↓
Stockfish Client
    ↓
Background Service Worker
    ↓
Offscreen Document
    ↓
Stockfish Web Worker + WASM
    ↓
bestmove
    ↓
SVG Overlay
```

---

## 11. Почему используется Offscreen Document

Content script работает на origin:

```text
https://www.chess.com
```

Поэтому напрямую запускать:

```ts
new Worker(
  chrome.runtime.getURL('engine/stockfish-18-lite-single.js')
)
```

из content script нельзя.

Chrome может выдать:

```text
SecurityError:
Failed to construct 'Worker'
```

Поэтому используется:

```text
content script
→ background
→ offscreen document
→ Stockfish worker
```

Offscreen document работает в:

```text
chrome-extension://...
```

и может запускать локальный Stockfish Worker.

---

## 12. Manifest V3

В `manifest.json` должны быть разрешения примерно:

```json
{
  "permissions": [
    "storage",
    "offscreen"
  ]
}
```

Host permissions:

```json
{
  "host_permissions": [
    "https://www.chess.com/*"
  ]
}
```

Stockfish assets:

```json
{
  "web_accessible_resources": [
    {
      "resources": [
        "engine/*"
      ],
      "matches": [
        "https://www.chess.com/*"
      ]
    }
  ]
}
```

CSP:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

---

## 13. Game mode gate

Проект должен работать только в разрешённых режимах:

```text
BOT
PRACTICE_COMPUTER
```

И блокировать:

```text
HUMAN
UNKNOWN
```

Основной файл:

```text
src/platform/chesscom/game-mode.ts
```

BOT route:

```ts
/^\/play\/computer(?:\/|$)/i
```

Пример:

```text
/play/computer
/play/computer/
/play/computer/Cliff-BOT
```

Для неразрешённых режимов:

```ts
liveHintsAllowed: false
```

Рекомендуется придерживаться принципа:

```text
не "блокируем известные human routes",
а "разрешаем только точно подтверждённые bot/practice routes".
```

Это fail-closed подход.

---

## 14. Позиция и FEN

Расширение строит piece placement из DOM:

```text
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR
```

После этого `chess.js` поддерживает полноценный FEN:

```text
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

Это важно для:

- очереди хода;
- рокировки;
- en passant;
- promotion;
- halfmove/fullmove counters.

---

## 15. Move detection

Расширение не пытается определять ход только через простой diff.

Используется `chess.js`.

Из текущей позиции генерируются legal moves, после чего определяется ход, который приводит к DOM snapshot.

Это позволяет корректно поддерживать:

- normal move;
- capture;
- castling;
- en passant;
- promotion.

Пример:

```text
g2g4
```

```text
d7d5
```

```text
e7e8q
```

---

## 16. Premove / transient DOM

Chess.com может визуально показать premove до того, как он стал реальным легальным ходом.

Поэтому DOM snapshot не должен автоматически считаться подтверждённой шахматной позицией.

Логика:

```text
DOM changed
→ chess.js validation
→ legal/reachable?
    YES → commit
    NO  → ignore transient state
```

Это защищает внутренний FEN от рассинхронизации.

---

## 17. Stockfish

Протокол:

```text
uci
→ uciok

isready
→ readyok

position fen <FEN>
go depth 12

→ info ...
→ bestmove ...
```

Пример:

```text
bestmove g1f3
```

Поддерживаются depth:

```text
8
10
12
14
16
```

Default:

```text
12
```

---

## 18. Popup

Popup предоставляет минимальные настройки:

### Best-move hints

```text
ON / OFF
```

### Engine depth

```text
8
10
12
14
16
```

Настройки сохраняются через:

```ts
chrome.storage.local
```

---

## 19. Поведение ON/OFF

При:

```text
OFF
```

расширение должно:

- убрать текущую подсказку;
- отменить активный Stockfish analysis;
- продолжать отслеживать шахматную позицию.

При повторном:

```text
ON
```

расширение должно использовать **текущую актуальную позицию**.

Если сейчас очередь пользователя:

```text
ON
→ analyze current FEN
→ показать свежий best move
```

Если сейчас очередь бота:

```text
ON
→ ждать ход бота
→ затем анализировать
```

Перезагрузка страницы или новая партия для этого не нужны.

---

## 20. Overlay

Overlay использует SVG поверх Chess.com board.

Поддерживает:

- best move arrow;
- source square;
- target square;
- promotion label;
- castling visualization;
- capture visualization;
- flipped board;
- resize;
- scroll.

Overlay:

```css
pointer-events: none;
```

поэтому не мешает управлять шахматной доской.

---

## 21. Orientation

Важно разделять:

```text
myColor
```

и:

```text
isFlipped
```

`myColor` — настоящий цвет игрока.

`isFlipped` — только визуальная ориентация доски.

Нельзя переворачивать FEN из-за Flip Board.

Stockfish всегда получает canonical FEN.

---

## 22. SPA lifecycle

Chess.com работает как SPA.

Поэтому extension должен корректно обрабатывать:

- переходы между страницами;
- новую игру;
- замену `<wc-chess-board>`;
- изменение URL;
- Flip Board;
- уход из bot game.

При cleanup необходимо уничтожать старую session:

```text
PositionObserver
AnalysisController
Overlay
logical Stockfish client
```

Нельзя создавать:

- duplicate observer;
- duplicate overlay;
- duplicate session;
- duplicate analysis.

---

## 23. Ограничение midgame resync

Если extension подключён **посреди уже начавшейся партии**, а надёжный full move history недоступен, проект намеренно не пытается придумывать FEN.

В таком случае может использоваться состояние:

```text
resyncUnsupported
```

Рекомендуемый workflow:

1. Reload extension.
2. Открыть Chess.com.
3. Начать новую стандартную bot game.

Это безопаснее, чем анализировать неправильный FEN.

---

## 24. Debug Console

Открыть:

```text
Chrome DevTools
→ Console
```

Фильтр:

```text
Chess Practice Overlay
```

Полезные сообщения:

```text
session started
USER e2e4
BOT e7e5
analyzing fen=...
bestmove ...
hint drawn
hint cleared
```

---

## 25. Offscreen / Service Worker debug

Откройте:

```text
chrome://extensions
```

Найдите extension.

Нажмите:

```text
Service worker → Inspect
```

Там можно проверять:

```text
offscreen document
Stockfish worker
runtime messaging
```

---

## 26. Ошибки Chess.com, которые можно игнорировать

В Console могут быть сообщения:

```text
AudioContext was not allowed to start
```

```text
CW Missing a base prebid mapping
```

```text
Raven
```

Они относятся к Chess.com и не являются ошибками extension.

Смотрите прежде всего сообщения:

```text
[Chess Practice Overlay]
```

---

## 27. Troubleshooting

### Extension не появляется

Проверьте, что загружена именно папка:

```text
dist
```

а не:

```text
src
```

или корень проекта.

---

### Изменения кода не применились

Сделайте:

```bash
npm run build
```

Потом:

```text
chrome://extensions
→ Reload
```

И hard refresh Chess.com.

---

### Stockfish assets отсутствуют

Проверить:

```bash
ls -lh public/engine
```

и:

```bash
ls -lh dist/engine
```

Если файлов нет, снова скопировать из:

```text
node_modules/stockfish/bin
```

---

### Worker SecurityError

Stockfish Worker не должен создаваться напрямую в Chess.com content script.

Используйте:

```text
content
→ background
→ offscreen
→ Worker
```

---

### Нет bestmove

Проверьте цепочку:

```text
engine ready
→ analyzing
→ position fen
→ go depth
→ bestmove
```

Если есть:

```text
analyzing
```

но нет:

```text
bestmove
```

проверяйте Offscreen / Worker console.

---

### Нет стрелки

Сначала убедитесь, что есть:

```text
bestmove
```

Если `bestmove` отсутствует, проблема не в overlay.

Если `bestmove` есть, проверяйте:

```text
drawHint
BoardOverlay
isFlipped
```

---

## 28. Рекомендуемый ручной тест

### Test 1 — white

Откройте:

```text
/play/computer
```

Начните новую игру белыми.

Сделайте:

```text
e2e4
```

После хода бота должна появиться подсказка.

---

### Test 2 — clear

Сделайте свой следующий ход.

Подсказка должна исчезнуть сразу.

---

### Test 3 — next best move

После следующего хода бота должна появиться новая подсказка.

---

### Test 4 — toggle

1. Выключить hints.
2. Сделать несколько ходов.
3. Включить hints.

Если сейчас ваш ход, новый best move должен появиться сразу.

---

### Test 5 — depth

Переключить:

```text
8 → 12 → 16
```

При включённых hints текущая позиция должна пересчитаться.

---

### Test 6 — resize

Изменить размер Chrome.

Overlay должен оставаться на нужных клетках.

---

### Test 7 — scroll

Прокрутить страницу.

Overlay должен оставаться поверх доски.

---

### Test 8 — Flip Board

Перевернуть доску.

Стрелка должна визуально перестроиться, но canonical FEN меняться не должен.

---

### Test 9 — black

Начать новую игру чёрными.

Проверить корректность:

```text
myColor=b
```

и направления стрелок.

---

### Test 10 — human game

При переходе в игру против человека live analysis должен быть отключён.

---

## 29. Пример структуры проекта

```text
chess-practice-overlay/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── vite.content.config.ts
├── public/
│   ├── manifest.json
│   ├── popup.html
│   ├── offscreen.html
│   └── engine/
│       ├── stockfish-18-lite-single.js
│       └── stockfish-18-lite-single.wasm
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   └── index.ts
│   ├── engine/
│   │   ├── analysis-controller.ts
│   │   └── stockfish-client.ts
│   ├── offscreen/
│   │   └── index.ts
│   ├── overlay/
│   │   ├── arrows.ts
│   │   ├── board-overlay.ts
│   │   └── coordinates.ts
│   ├── platform/
│   │   └── chesscom/
│   │       ├── board-detector.ts
│   │       ├── fen-builder.ts
│   │       ├── game-mode.ts
│   │       ├── orientation.ts
│   │       ├── piece-parser.ts
│   │       └── position-observer.ts
│   ├── popup/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── popup.css
│   ├── shared/
│   │   ├── chess-state.ts
│   │   ├── constants.ts
│   │   └── messages.ts
│   └── types/
│       └── index.ts
└── dist/
```

---

## 30. Final build checklist

Перед публикацией/передачей:

```bash
npm install
```

```bash
npm run typecheck
```

```bash
npm run build
```

```bash
ls -lh dist/engine
```

Проверить:

```text
stockfish-18-lite-single.js
stockfish-18-lite-single.wasm
```

Потом:

```text
chrome://extensions
→ Load unpacked
→ dist
```

---

## 31. Назначение проекта

Проект предназначен для:

- изучения Chrome Extension API;
- работы с DOM chessboard;
- realtime state tracking;
- chess.js;
- Stockfish WASM;
- Web Worker;
- Offscreen Document;
- SVG overlays;
- анализа партий против компьютера;
- локального educational chess practice.

Не используйте live engine assistance против реальных игроков.

---

## License

Добавьте нужную лицензию проекта, например MIT:

```text
MIT License
```

