import type { BestMove, ChessColor, GameMode } from '../types';
import type { ExtensionSettings } from './constants';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'thinking' | 'error';
export type SessionStatus =
  | 'inactive'
  | 'waitingForBoard'
  | 'waitingForPlayerColor'
  | 'resyncUnsupported'
  | 'active';

export interface ExtensionRuntimeState {
  active: boolean;
  sessionStatus: SessionStatus;
  gameMode: GameMode;
  liveHintsAllowed: boolean;
  myColor: ChessColor | null;
  engineStatus: EngineStatus;
  fen: string | null;
  bestMove: string | null;
  evaluation: number | null;
  mate: number | null;
  depth: number | null;
  error: string | null;
}

export const EMPTY_RUNTIME_STATE: ExtensionRuntimeState = {
  active: false,
  sessionStatus: 'inactive',
  gameMode: 'UNKNOWN',
  liveHintsAllowed: false,
  myColor: null,
  engineStatus: 'idle',
  fen: null,
  bestMove: null,
  evaluation: null,
  mate: null,
  depth: null,
  error: null
};

export type ExtensionMessage =
  | { type: 'GET_RUNTIME_STATE' }
  | { type: 'RUNTIME_STATE_UPDATED'; state: ExtensionRuntimeState }
  | { type: 'SETTINGS_UPDATED'; settings: ExtensionSettings };

export interface RuntimeStateResponse {
  state: ExtensionRuntimeState;
}

export interface StockfishAnalysis {
  bestMove: BestMove | null;
  evaluation: number | null;
  mate: number | null;
  depth: number;
}

export type EngineRequest =
  | { type: 'ENGINE_INIT'; requestId: string }
  | { type: 'ENGINE_ANALYZE'; requestId: string; fen: string; depth: number }
  | { type: 'ENGINE_CANCEL'; requestId: string }
  | { type: 'ENGINE_DESTROY'; requestId: string };

export type EngineHostRequest =
  | { type: 'OFFSCREEN_ENGINE_INIT'; requestId: string }
  | { type: 'OFFSCREEN_ENGINE_ANALYZE'; requestId: string; fen: string; depth: number }
  | { type: 'OFFSCREEN_ENGINE_CANCEL'; requestId: string }
  | { type: 'OFFSCREEN_ENGINE_DESTROY'; requestId: string };

export type EngineResponse =
  | { type: 'ENGINE_READY'; requestId: string }
  | { type: 'ENGINE_RESULT'; requestId: string; fen: string; result: StockfishAnalysis }
  | { type: 'ENGINE_CANCELLED'; requestId: string }
  | { type: 'ENGINE_ERROR'; requestId: string; error: string };
