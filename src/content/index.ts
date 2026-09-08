import { AnalysisController } from '../engine/analysis-controller';
import { StockfishClient } from '../engine/stockfish-client';
import { BoardOverlay } from '../overlay/board-overlay';
import { detectMainBoard } from '../platform/chesscom/board-detector';
import { createPositionSnapshot } from '../platform/chesscom/fen-builder';
import { detectGameMode } from '../platform/chesscom/game-mode';
import { detectOrientation } from '../platform/chesscom/orientation';
import { PositionObserver } from '../platform/chesscom/position-observer';
import { ChessState } from '../shared/chess-state';
import { DEFAULT_SETTINGS, POSITION_DEBOUNCE_MS, SESSION_RECHECK_MS, normalizeSettings, type ExtensionSettings } from '../shared/constants';
import { EMPTY_RUNTIME_STATE, type ExtensionMessage, type ExtensionRuntimeState, type RuntimeStateResponse } from '../shared/messages';
import type { ChessColor } from '../types';

const START_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
let settings: ExtensionSettings = DEFAULT_SETTINGS;
let runtimeState: ExtensionRuntimeState = { ...EMPTY_RUNTIME_STATE };
let session: GameSession | null = null;
let documentObserver: MutationObserver | null = null;
let recheckTimer: number | null = null;
let lastUrl = location.href;
let forceRestart = false;
let forcedMyColor: ChessColor | null = null;
let lastDetectionLog = '';

function publish(patch: Partial<ExtensionRuntimeState>): void {
  runtimeState = { ...runtimeState, ...patch };
  void chrome.runtime.sendMessage({ type: 'RUNTIME_STATE_UPDATED', state: runtimeState } satisfies ExtensionMessage).catch(() => undefined);
}

class GameSession {
  private readonly overlay: BoardOverlay;
  private readonly engine: StockfishClient;
  private readonly controller: AnalysisController;
  private readonly chess = new ChessState();
  private observer: PositionObserver | null = null;
  private orientationObserver: MutationObserver | null = null;
  private destroyed = false;

  constructor(readonly board: HTMLElement, readonly myColor: ChessColor, readonly isFlipped: boolean) {
    this.overlay = new BoardOverlay(board, isFlipped);
    this.engine = new StockfishClient();
    this.controller = new AnalysisController({ engine: this.engine, overlay: this.overlay, myColor,
      depth: settings.engineDepth, arrowsEnabled: settings.arrowsEnabled, onState: publish });
  }

  start(): void {
    this.controller.setCurrentPosition(this.chess.getFen(), this.chess.getTurn());
    publish({ active: true, sessionStatus: 'active', myColor: this.myColor,
      engineStatus: 'loading', fen: this.chess.getFen(), error: null });
    void this.engine.init().then(() => {
      if (!this.destroyed && runtimeState.engineStatus === 'loading') publish({ engineStatus: 'ready' });
    }).catch((error: unknown) => {
      if (!this.destroyed) publish({ engineStatus: 'error', error: error instanceof Error ? error.message : String(error) });
    });
    this.observer = new PositionObserver({ board: this.board, isFlipped: this.isFlipped, debounceMs: POSITION_DEBOUNCE_MS,
      onChange: ({ current }) => {
        const moves = this.chess.detectAndApplyMoves(current, 2);
        if (!moves) {
          if (current.piecePlacementFen === START_PLACEMENT) {
            forceRestart = true;
            scheduleRecheck();
          }
          return false;
        }
        for (const move of moves) {
          const actor = move.color === this.myColor ? 'USER' : 'BOT';
          console.log(`[Chess Practice Overlay] ${actor} ${move.uci}`);
          const fen = move.afterFen;
          publish({ fen, bestMove: null, evaluation: null, mate: null, depth: null });
          const nextTurn: ChessColor = move.color === 'w' ? 'b' : 'w';
          this.controller.handleConfirmedMove(move, fen, nextTurn);
        }
        return true;
      } });
    this.observer.start();
    this.orientationObserver = new MutationObserver(() => {
      const visual = detectOrientation(this.board);
      if (visual.isFlipped !== this.isFlipped) {
        forcedMyColor = this.myColor;
        forceRestart = true;
        scheduleRecheck();
      }
    });
    this.orientationObserver.observe(this.board, { attributes: true, attributeFilter: ['class'] });
    console.log('[Chess Practice Overlay] session started', `mode=${runtimeState.gameMode} myColor=${this.myColor} flipped=${this.isFlipped}`);
  }

  updateSettings(): void { this.controller.updateSettings(settings.engineDepth, settings.arrowsEnabled); }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer?.stop();
    this.orientationObserver?.disconnect();
    this.controller.destroy();
    this.engine.destroy();
    this.overlay.destroy();
  }
}

function cleanupSession(): void { session?.destroy(); session = null; }

function logDetection(mode: string, pieces: number | null, initialStandard: boolean | null): boolean {
  const key = `${location.pathname}|${mode}|${pieces ?? 'none'}|${initialStandard ?? 'unknown'}`;
  if (key === lastDetectionLog) return false;
  lastDetectionLog = key;
  console.log(`[Chess Practice Overlay] detected pathname=${location.pathname}`);
  console.log(`[Chess Practice Overlay] detected mode=${mode}`);
  console.log(`[Chess Practice Overlay] board detected pieces=${pieces ?? 0}`);
  if (initialStandard !== null) {
    console.log(`[Chess Practice Overlay] initialPositionStandard=${initialStandard}`);
  }
  return true;
}

function reconcile(): void {
  recheckTimer = null;
  const restart = forceRestart;
  forceRestart = false;
  const mode = detectGameMode();
  const detected = detectMainBoard();
  publish({ gameMode: mode.mode, liveHintsAllowed: mode.liveHintsAllowed });
  const pieceCount = detected?.element.querySelectorAll('.piece').length ?? null;
  if (!mode.liveHintsAllowed) {
    const changed = logDetection(mode.mode, pieceCount, null);
    cleanupSession();
    publish({ active: false, sessionStatus: 'inactive', myColor: null, engineStatus: 'idle', fen: null,
      bestMove: null, evaluation: null, mate: null, depth: null, error: null });
    if (changed) console.log('[Chess Practice Overlay] session start skipped reason=liveHintsDisabled');
    return;
  }
  if (!detected || pieceCount === 0) {
    const changed = logDetection(mode.mode, pieceCount, null);
    cleanupSession();
    publish({ active: false, sessionStatus: 'waitingForBoard', myColor: null, engineStatus: 'idle', fen: null,
      bestMove: null, evaluation: null, mate: null, depth: null, error: 'Waiting for a playable board.' });
    if (changed) console.log('[Chess Practice Overlay] session start skipped reason=boardNotReady');
    return;
  }
  const orientation = detectOrientation(detected.element);
  const snapshot = createPositionSnapshot(detected.element, orientation.isFlipped);
  const initialPositionStandard = snapshot.piecePlacementFen === START_PLACEMENT;
  const changed = logDetection(mode.mode, pieceCount, initialPositionStandard);
  if (!initialPositionStandard) {
    cleanupSession();
    publish({ active: false, sessionStatus: 'resyncUnsupported', myColor: orientation.myColor,
      engineStatus: 'idle', fen: null, bestMove: null, evaluation: null, mate: null, depth: null,
      error: 'Position resync is unsupported; waiting for a new standard game.' });
    if (changed) console.log('[Chess Practice Overlay] session start skipped reason=resyncUnsupported');
    return;
  }
  if (!restart && session && session.board === detected.element && session.isFlipped === orientation.isFlipped) return;
  cleanupSession();
  const myColor = forcedMyColor ?? orientation.myColor;
  forcedMyColor = null;
  session = new GameSession(detected.element, myColor, orientation.isFlipped);
  session.start();
}

function scheduleRecheck(): void {
  if (recheckTimer === null) recheckTimer = window.setTimeout(reconcile, SESSION_RECHECK_MS);
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'GET_RUNTIME_STATE') sendResponse({ state: runtimeState } satisfies RuntimeStateResponse);
  else if (message.type === 'SETTINGS_UPDATED') {
    settings = normalizeSettings(message.settings);
    session?.updateSettings();
  }
});

chrome.storage.local.get({ arrowsEnabled: DEFAULT_SETTINGS.arrowsEnabled, engineDepth: DEFAULT_SETTINGS.engineDepth })
  .then((stored) => { settings = normalizeSettings(stored); reconcile(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  settings = normalizeSettings({
    arrowsEnabled: (changes.arrowsEnabled?.newValue as boolean | undefined) ?? settings.arrowsEnabled,
    engineDepth: (changes.engineDepth?.newValue as number | undefined) ?? settings.engineDepth
  });
  session?.updateSettings();
});

documentObserver = new MutationObserver(() => {
  if (location.href !== lastUrl || !session || !session.board.isConnected) {
    lastUrl = location.href;
    scheduleRecheck();
  }
});
documentObserver.observe(document.documentElement, { subtree: true, childList: true });
window.addEventListener('popstate', scheduleRecheck);
window.addEventListener('hashchange', scheduleRecheck);
window.addEventListener('pagehide', () => {
  cleanupSession();
  documentObserver?.disconnect();
  if (recheckTimer !== null) clearTimeout(recheckTimer);
}, { once: true });

console.log('[Chess Practice Overlay] content script loaded');
