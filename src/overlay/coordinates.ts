import type {
  Square
} from '../types';

export interface Point {
  x: number;
  y: number;
}

/**
 * SVG uses:
 *
 * viewBox="0 0 8 8"
 *
 * So:
 * one chess square = one SVG unit.
 */
export function squareToCenter(
  square: Square,
  isFlipped: boolean
): Point {
  const file =
    square.charCodeAt(0) - 97;

  const rank =
    Number(square[1]);

  if (!isFlipped) {
    return {
      x: file + 0.5,
      y: 8 - rank + 0.5
    };
  }

  return {
    x: 7 - file + 0.5,
    y: rank - 1 + 0.5
  };
}

export function shortenLine(
  start: Point,
  end: Point,
  amount = 0.28
): Point {
  const dx =
    end.x - start.x;

  const dy =
    end.y - start.y;

  const length =
    Math.hypot(dx, dy);

  if (length === 0) {
    return end;
  }

  return {
    x:
      end.x -
      (dx / length) *
        amount,

    y:
      end.y -
      (dy / length) *
        amount
  };
}