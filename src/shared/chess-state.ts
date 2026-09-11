import {
  Chess,
  type Move
} from 'chess.js';

import type {
  ChessColor,
  PieceType,
  PositionSnapshot,
  Square
} from '../types';

export interface DetectedMove {
  from: Square;
  to: Square;

  color: ChessColor;
  piece: PieceType;

  promotion?: PieceType;
  captured?: PieceType;

  san: string;
  uci: string;

  beforeFen: string;
  afterFen: string;
}

function getPiecePlacement(
  fen: string
): string {
  return (
    fen.split(' ')[0] ?? ''
  );
}

function normalizeMove(
  move: Move
): DetectedMove {
  const promotion =
    move.promotion as
      | PieceType
      | undefined;

  return {
    from:
      move.from as Square,

    to:
      move.to as Square,

    color:
      move.color as ChessColor,

    piece:
      move.piece as PieceType,

    promotion,

    captured:
      move.captured as
        | PieceType
        | undefined,

    san:
      move.san,

    uci:
      `${move.from}${move.to}${promotion ?? ''}`,

    beforeFen:
      move.before,

    afterFen:
      move.after
  };
}

interface SearchResult {
  moves: Move[];
}

export class ChessState {
  private chess:
    Chess;

  constructor(fen?: string) {
    this.chess = fen
      ? new Chess(fen)
      : new Chess();
  }

  reset(): void {
    this.chess =
      new Chess();
  }

  getFen(): string {
    return this.chess.fen();
  }

  getTurn():
    ChessColor {
    return (
      this.chess.turn() as
        ChessColor
    );
  }

  matchesSnapshot(
    snapshot:
      PositionSnapshot
  ): boolean {
    return (
      getPiecePlacement(
        this.chess.fen()
      ) ===
      snapshot.piecePlacementFen
    );
  }

  /**
   * Search up to maxDepth legal plies
   * from our internal position.
   *
   * depth 1:
   * BOT moved
   *
   * depth 2:
   * BOT moved + user's premove
   */
  private searchSequence(
    chess: Chess,
    targetPlacement: string,
    maxDepth: number,
    path: Move[] = []
  ): SearchResult | null {
    if (
      path.length >=
      maxDepth
    ) {
      return null;
    }

    const legalMoves =
      chess.moves({
        verbose: true
      });

    for (
      const move of legalMoves
    ) {
      const next =
        new Chess(
          move.after
        );

      const nextPath = [
        ...path,
        move
      ];

      if (
        getPiecePlacement(
          move.after
        ) ===
        targetPlacement
      ) {
        return {
          moves:
            nextPath
        };
      }

      if (
        nextPath.length <
        maxDepth
      ) {
        const deeper =
          this.searchSequence(
            next,
            targetPlacement,
            maxDepth,
            nextPath
          );

        if (deeper) {
          return deeper;
        }
      }
    }

    return null;
  }

  detectAndApplyMoves(
    current:
      PositionSnapshot,

    maxDepth = 2
  ): DetectedMove[] | null {
    const target =
      current.piecePlacementFen;

    const search =
      this.searchSequence(
        new Chess(
          this.chess.fen()
        ),
        target,
        maxDepth
      );

    if (!search) {
      console.debug(
        '[Chess Practice Overlay] DOM state is not a legal reachable position yet',
        {
          targetPlacement:
            target,

          currentFen:
            this.chess.fen()
        }
      );

      return null;
    }

    const detected:
      DetectedMove[] = [];

    for (
      const candidate
      of search.moves
    ) {
      const move =
        this.chess.move({
          from:
            candidate.from,

          to:
            candidate.to,

          promotion:
            candidate.promotion
        });

      if (!move) {
        return null;
      }

      detected.push(
        normalizeMove(
          move
        )
      );
    }

    return detected;
  }
}
