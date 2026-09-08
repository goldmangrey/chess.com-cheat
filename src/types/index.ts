export type ChessColor = 'w' | 'b';

export type PieceType =
  | 'p'
  | 'n'
  | 'b'
  | 'r'
  | 'q'
  | 'k';

export type FenPiece =
  | 'P'
  | 'N'
  | 'B'
  | 'R'
  | 'Q'
  | 'K'
  | 'p'
  | 'n'
  | 'b'
  | 'r'
  | 'q'
  | 'k';

export type Square =
  `${'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export type GameMode =
  | 'RATED'
  | 'BOT'
  | 'PRACTICE_COMPUTER'
  | 'HUMAN'
  | 'UNKNOWN';

export interface GameModeResult {
  mode: GameMode;
  liveHintsAllowed: boolean;

  confidence:
    | 'high'
    | 'medium'
    | 'low';

  reasons: string[];
}

export interface PlayerOrientation {
  myColor: ChessColor;
  isFlipped: boolean;
}

export interface ParsedPiece {
  square: Square;
  piece: FenPiece;
  element: HTMLElement;
}

export interface PositionSnapshot {
  pieces: Map<Square, FenPiece>;
  fingerprint: string;
  piecePlacementFen: string;
  timestamp: number;
}

export interface BestMove {
  from: Square;
  to: Square;

  promotion?: PieceType;

  uci: string;
}

export interface EngineAnalysis {
  fen: string;

  bestMove:
    | BestMove
    | null;

  evaluation:
    | number
    | null;

  depth:
    | number
    | null;
}