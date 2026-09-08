import type { BestMove, PieceType, Square } from '../types';
import type { EngineHostRequest, EngineResponse, StockfishAnalysis } from '../shared/messages';

const INIT_TIMEOUT_MS = 10_000;
const ANALYSIS_TIMEOUT_MS = 20_000;

interface PendingAnalysis {
  requestId: string;
  fen: string;
  resolve: (result: StockfishAnalysis) => void;
  reject: (error: Error) => void;
  evaluation: number | null;
  mate: number | null;
  depth: number;
  timeoutId: number;
}

function abortError(): Error { return new DOMException('Stockfish analysis cancelled', 'AbortError'); }

function parseBestMove(uci: string): BestMove | null {
  const match = /^([a-h][1-8])([a-h][1-8])([nbrq])?$/.exec(uci);
  if (!match) return null;
  return { from: match[1] as Square, to: match[2] as Square,
    promotion: match[3] as PieceType | undefined, uci };
}

class OffscreenStockfishHost {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private initTimeoutId: number | null = null;
  private pending: PendingAnalysis | null = null;
  private discardedBestMoves = 0;
  private waiters = new Map<string, Set<() => void>>();

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise<void>((resolve, reject) => {
      const jsUrl = chrome.runtime.getURL('engine/stockfish-18-lite-single.js');
      const wasmUrl = chrome.runtime.getURL('engine/stockfish-18-lite-single.wasm');
      console.log('[Chess Practice Overlay] engine worker creating', { jsUrl, wasmUrl });
      let worker: Worker;
      try {
        // Stockfish 18.0.8 expects the WASM URL in hash component zero.
        // Do not append `,worker`: that flag skips the outer UCI bootstrap.
        worker = new Worker(`${jsUrl}#${encodeURIComponent(wasmUrl)}`);
      } catch (error) {
        console.error('[Chess Practice Overlay] worker creation error', error);
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      this.worker = worker;
      console.log('[Chess Practice Overlay] engine worker created');
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data === 'string') this.handleLine(event.data);
      };
      worker.onerror = (event) => {
        const error = new Error(`WASM loading/worker error: ${event.message || 'Stockfish worker failed'}`);
        console.error('[Chess Practice Overlay] worker.onerror', error);
        this.fail(error);
        reject(error);
      };
      worker.onmessageerror = () => {
        const error = new Error('Stockfish worker.onmessageerror: invalid worker message');
        console.error('[Chess Practice Overlay] worker.onmessageerror', error);
        this.fail(error);
        reject(error);
      };
      this.initTimeoutId = window.setTimeout(() => {
        const error = new Error('Stockfish engine init timeout after 10s (missing uciok/readyok)');
        console.error('[Chess Practice Overlay] engine init timeout', error);
        this.fail(error);
        reject(error);
      }, INIT_TIMEOUT_MS);
      this.waitFor('uciok').then(() => {
        console.log('[Chess Practice Overlay] engine uciok');
        this.send('isready');
        return this.waitFor('readyok');
      }).then(() => {
        console.log('[Chess Practice Overlay] engine readyok');
        this.clearInitTimeout();
        resolve();
      });
      this.send('uci');
    });
    return this.initPromise;
  }

  async analyze(requestId: string, fen: string, depth: number): Promise<StockfishAnalysis> {
    await this.init();
    this.cancel();
    const result = new Promise<StockfishAnalysis>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (this.pending?.requestId !== requestId) return;
        const error = new Error('Stockfish analysis timeout after 20s');
        console.error('[Chess Practice Overlay] analysis timeout', error);
        this.discardedBestMoves++;
        this.send('stop');
        this.pending = null;
        reject(error);
      }, ANALYSIS_TIMEOUT_MS);
      this.pending = { requestId, fen, resolve, reject, evaluation: null, mate: null, depth: 0, timeoutId };
    });
    this.send(`position fen ${fen}`);
    this.send(`go depth ${Math.max(1, Math.floor(depth))}`);
    return result;
  }

  cancel(requestId?: string): void {
    if (!this.pending || (requestId && this.pending.requestId !== requestId)) return;
    const pending = this.pending;
    this.pending = null;
    this.discardedBestMoves++;
    this.send('stop');
    clearTimeout(pending.timeoutId);
    pending.reject(abortError());
  }

  destroy(): void {
    this.cancel();
    this.clearInitTimeout();
    this.send('quit');
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
    this.waiters.clear();
  }

  private send(command: string): void {
    if (/^(uci|isready|position fen |go depth )/.test(command)) {
      console.log(`[Chess Practice Overlay] engine sent: ${command}`);
    }
    this.worker?.postMessage(command);
  }

  private waitFor(token: string): Promise<void> {
    return new Promise((resolve) => {
      const callbacks = this.waiters.get(token) ?? new Set<() => void>();
      callbacks.add(resolve);
      this.waiters.set(token, callbacks);
    });
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (trimmed.startsWith('Stockfish ') || trimmed.startsWith('id name ')) {
      console.log(`[Chess Practice Overlay] engine message: ${trimmed}`);
    }
    const callbacks = this.waiters.get(trimmed);
    if (callbacks) {
      callbacks.forEach((resolve) => resolve());
      this.waiters.delete(trimmed);
    }
    const best = /^bestmove\s+(\S+)/.exec(trimmed);
    if (best && this.discardedBestMoves > 0) {
      this.discardedBestMoves--;
      return;
    }
    const pending = this.pending;
    if (!pending) return;
    if (trimmed.startsWith('info ')) {
      const depth = /\bdepth (\d+)/.exec(trimmed);
      const cp = /\bscore cp (-?\d+)/.exec(trimmed);
      const mate = /\bscore mate (-?\d+)/.exec(trimmed);
      if (depth) pending.depth = Number(depth[1]);
      if (cp) { pending.evaluation = Number(cp[1]) / 100; pending.mate = null; }
      if (mate) { pending.mate = Number(mate[1]); pending.evaluation = null; }
      return;
    }
    if (!best) return;
    this.pending = null;
    clearTimeout(pending.timeoutId);
    console.log(`[Chess Practice Overlay] engine bestmove ${best[1]}`);
    pending.resolve({ bestMove: best[1] === '(none)' ? null : parseBestMove(best[1]),
      evaluation: pending.evaluation, mate: pending.mate, depth: pending.depth });
  }

  private fail(error: Error): void {
    this.clearInitTimeout();
    if (this.pending) clearTimeout(this.pending.timeoutId);
    this.pending?.reject(error);
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
    this.waiters.clear();
  }

  private clearInitTimeout(): void {
    if (this.initTimeoutId === null) return;
    clearTimeout(this.initTimeoutId);
    this.initTimeoutId = null;
  }
}

const host = new OffscreenStockfishHost();

chrome.runtime.onMessage.addListener((message: EngineHostRequest, _sender, sendResponse) => {
  if (!message.type?.startsWith('OFFSCREEN_ENGINE_')) return false;
  void (async () => {
    try {
      if (message.type === 'OFFSCREEN_ENGINE_INIT') {
        await host.init();
        sendResponse({ type: 'ENGINE_READY', requestId: message.requestId } satisfies EngineResponse);
      } else if (message.type === 'OFFSCREEN_ENGINE_ANALYZE') {
        const result = await host.analyze(message.requestId, message.fen, message.depth);
        sendResponse({ type: 'ENGINE_RESULT', requestId: message.requestId, fen: message.fen, result } satisfies EngineResponse);
      } else if (message.type === 'OFFSCREEN_ENGINE_CANCEL') {
        host.cancel(message.requestId);
        sendResponse({ type: 'ENGINE_CANCELLED', requestId: message.requestId } satisfies EngineResponse);
      } else {
        host.destroy();
        sendResponse({ type: 'ENGINE_CANCELLED', requestId: message.requestId } satisfies EngineResponse);
      }
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError';
      sendResponse(cancelled
        ? { type: 'ENGINE_CANCELLED', requestId: message.requestId }
        : { type: 'ENGINE_ERROR', requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error) } satisfies EngineResponse);
    }
  })();
  return true;
});

console.log('[Chess Practice Overlay] offscreen engine host loaded');
