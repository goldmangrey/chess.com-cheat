import type { EngineRequest, EngineResponse, StockfishAnalysis } from '../shared/messages';

export type { StockfishAnalysis } from '../shared/messages';
export interface AnalyzeOptions { depth: number; }

function abortError(): Error {
  return new DOMException('Stockfish analysis cancelled', 'AbortError');
}

function requestId(): string {
  return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
}

export class StockfishClient {
  private activeRequestId: string | null = null;
  private generation = 0;
  private destroyed = false;
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (this.destroyed) return Promise.reject(new Error('Stockfish client is destroyed'));
    if (this.initPromise) return this.initPromise;
    const id = requestId();
    this.initPromise = this.send({ type: 'ENGINE_INIT', requestId: id }).then((response) => {
        if (response.type === 'ENGINE_ERROR') throw new Error(response.error);
        if (response.type !== 'ENGINE_READY' || response.requestId !== id) {
          throw new Error('Unexpected Stockfish init response');
        }
      });
    return this.initPromise;
  }

  async analyze(fen: string, options: AnalyzeOptions): Promise<StockfishAnalysis> {
    this.cancel();
    const generation = ++this.generation;
    await this.init();
    if (this.destroyed || generation !== this.generation) throw abortError();

    const id = requestId();
    this.activeRequestId = id;
    const response = await this.send({
      type: 'ENGINE_ANALYZE', requestId: id, fen,
      depth: Math.max(1, Math.floor(options.depth))
    });
    if (this.destroyed || generation !== this.generation || this.activeRequestId !== id) throw abortError();
    this.activeRequestId = null;
    if (response.requestId !== id) throw new Error('Mismatched Stockfish response requestId');
    if (response.type === 'ENGINE_CANCELLED') throw abortError();
    if (response.type === 'ENGINE_ERROR') throw new Error(response.error);
    if (response.type !== 'ENGINE_RESULT' || response.fen !== fen) {
      throw new Error('Stale or unexpected Stockfish analysis response');
    }
    return response.result;
  }

  cancel(): void {
    this.generation++;
    const id = this.activeRequestId;
    this.activeRequestId = null;
    if (id) void this.send({ type: 'ENGINE_CANCEL', requestId: id }).catch(() => undefined);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.cancel();
    this.destroyed = true;
  }

  private send(message: EngineRequest): Promise<EngineResponse> {
    return chrome.runtime.sendMessage<EngineRequest, EngineResponse>(message);
  }
}
