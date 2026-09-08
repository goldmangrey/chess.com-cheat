import type {
  FenPiece,
  PositionSnapshot,
  Square
} from '../../types';

import {
  parsePieces
} from './piece-parser';

const FILES = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h'
] as const;

function makeSquare(
  file: string,
  rank: number
): Square {
  return `${file}${rank}` as Square;
}

export function buildPiecePlacementFen(
  pieces: Map<
    Square,
    FenPiece
  >
): string {
  const ranks: string[] = [];

  for (
    let rank = 8;
    rank >= 1;
    rank--
  ) {
    let result = '';
    let emptyCount = 0;

    for (
      const file of FILES
    ) {
      const square =
        makeSquare(
          file,
          rank
        );

      const piece =
        pieces.get(square);

      if (!piece) {
        emptyCount++;
        continue;
      }

      if (
        emptyCount > 0
      ) {
        result +=
          emptyCount.toString();

        emptyCount = 0;
      }

      result += piece;
    }

    if (
      emptyCount > 0
    ) {
      result +=
        emptyCount.toString();
    }

    ranks.push(result);
  }

  return ranks.join('/');
}

export function buildFingerprint(
  pieces: Map<
    Square,
    FenPiece
  >
): string {
  return Array
    .from(
      pieces.entries()
    )
    .sort(
      ([squareA], [squareB]) =>
        squareA.localeCompare(
          squareB
        )
    )
    .map(
      ([square, piece]) =>
        `${square}:${piece}`
    )
    .join('|');
}

export function createPositionSnapshot(
  board: HTMLElement,
  isFlipped: boolean
): PositionSnapshot {
  const parsed =
    parsePieces(
      board,
      isFlipped
    );

  const pieces =
    new Map<
      Square,
      FenPiece
    >();

  for (
    const item
    of parsed
  ) {
    pieces.set(
      item.square,
      item.piece
    );
  }

  return {
    pieces,

    fingerprint:
      buildFingerprint(
        pieces
      ),

    piecePlacementFen:
      buildPiecePlacementFen(
        pieces
      ),

    timestamp:
      Date.now()
  };
}