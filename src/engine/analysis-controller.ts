import type { DetectedMove } from '../shared/chess-state';
import type { ChessColor } from '../types';
import type { BoardOverlay } from '../overlay/board-overlay';
import type { EngineStatus, ExtensionRuntimeState } from '../shared/messages';
import type { StockfishClient } from './stockfish-client';
import { Chess } from 'chess.js';
import type { BestMove, PieceType, Square } from '../types';

interface Options {
  engine: StockfishClient;
  overlay: BoardOverlay;
  myColor: ChessColor;
  depth: number;
  arrowsEnabled: boolean;
  onState: (patch: Partial<ExtensionRuntimeState>) => void;
}

export class AnalysisController {
  private generation = 0;
  private destroyed = false;
  private lastAnalyzedFen: string | null = null;
  private currentFen: string | null = null;
  private currentTurn: ChessColor | null = null;
  constructor(private options: Options) {}

  updateSettings(depth: number, arrowsEnabled: boolean): void {
    const depthChanged = depth !== this.options.depth;
    const enabledChanged = arrowsEnabled !== this.options.arrowsEnabled;
    this.options.depth = depth;
    this.options.arrowsEnabled = arrowsEnabled;
    if (!arrowsEnabled) {
      if (enabledChanged) console.log('[Chess Practice Overlay] hints toggled off');
      this.lastAnalyzedFen = null;
      this.clearAndCancel('idle');
      return;
    }
    if (!enabledChanged && !depthChanged) return;
    console.log(enabledChanged
      ? '[Chess Practice Overlay] hints toggled on'
      : `[Chess Practice Overlay] engine depth changed to ${depth}`);
    this.lastAnalyzedFen = null;
    this.clearAndCancel('ready');
    this.maybeResumeAnalysis();
  }

  setCurrentPosition(fen: string, turn: ChessColor): void {
    this.currentFen = fen;
    this.currentTurn = turn;
  }

  handleConfirmedMove(move: DetectedMove, fen: string, turn: ChessColor): void {
    if (this.destroyed) return;
    this.setCurrentPosition(fen, turn);
    if (!this.options.arrowsEnabled) return;
    if (move.color === this.options.myColor) {
      this.clearAndCancel('ready');
      return;
    }
    if (turn !== this.options.myColor) {
      this.clearAndCancel('ready');
      return;
    }
    void this.analyze(fen);
  }

  clearAndCancel(status: EngineStatus = 'ready'): void {
    this.generation++;
    this.options.engine.cancel();
    const cleared = this.options.overlay.clear();
    if (cleared) console.log('[Chess Practice Overlay] hint cleared');
    this.options.onState({ engineStatus: status, bestMove: null, evaluation: null, mate: null, depth: null });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearAndCancel('idle');
  }

  private async analyze(fen: string): Promise<void> {
    if (fen === this.lastAnalyzedFen) return;
    this.clearAndCancel('thinking');
    const generation = ++this.generation;
    this.lastAnalyzedFen = fen;
    this.options.onState({ engineStatus: 'thinking', fen });
    console.log('[Chess Practice Overlay] analyzing', `fen=${fen}`);
    try {
      const result = await this.options.engine.analyze(fen, { depth: this.options.depth });
      if (this.destroyed || generation !== this.generation) return;
      this.options.overlay.clear();
      if (result.bestMove && this.options.arrowsEnabled) {
        const presentation = describeMove(fen, result.bestMove);
        this.options.overlay.drawHint({ ...result.bestMove, ...presentation });
        console.log('[Chess Practice Overlay] hint drawn', presentation.label);
      }
      this.options.onState({
        engineStatus: 'ready', bestMove: result.bestMove?.uci ?? null,
        evaluation: result.evaluation, mate: result.mate, depth: result.depth
      });
      console.log('[Chess Practice Overlay] bestmove', result.bestMove?.uci ?? '(none)',
        `depth=${result.depth}`, result.mate !== null ? `mate=${result.mate}` : `eval=${result.evaluation ?? 'n/a'}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (generation !== this.generation || this.destroyed) return;
      console.error('[Chess Practice Overlay] engine analysis failed', error);
      this.options.onState({ engineStatus: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }

  private maybeResumeAnalysis(): void {
    if (!this.destroyed && this.options.arrowsEnabled && this.currentFen && this.currentTurn === this.options.myColor) {
      void this.analyze(this.currentFen);
    }
  }
}

const PIECE_LABELS: Record<PieceType, string> = {
  p: 'Pawn', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K'
};

function describeMove(fen: string, bestMove: BestMove): {
  label: string;
  capture: boolean;
  rook?: { from: Square; to: Square };
} {
  const chess = new Chess(fen);
  const movingPiece = chess.get(bestMove.from);
  const move = chess.move({ from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion });
  const capture = Boolean(move?.captured);
  if (move?.san.startsWith('O-O-O')) {
    const rank = bestMove.from[1];
    return { label: 'Castle queenside', capture: false,
      rook: { from: `a${rank}` as Square, to: `d${rank}` as Square } };
  }
  if (move?.san.startsWith('O-O')) {
    const rank = bestMove.from[1];
    return { label: 'Castle kingside', capture: false,
      rook: { from: `h${rank}` as Square, to: `f${rank}` as Square } };
  }
  if (bestMove.promotion) {
    const promoted = bestMove.promotion === 'q' ? 'Queen'
      : bestMove.promotion === 'r' ? 'Rook'
      : bestMove.promotion === 'b' ? 'Bishop' : 'Knight';
    return { label: `Promote to ${promoted}`, capture };
  }
  if (capture && move) return { label: move.san.replace(/[+#]$/, ''), capture };
  const piece = movingPiece?.type ?? 'p';
  return { label: piece === 'p' ? bestMove.to : `${PIECE_LABELS[piece]} → ${bestMove.to}`, capture };
}
