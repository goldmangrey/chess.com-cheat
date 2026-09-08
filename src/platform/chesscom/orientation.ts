import type {
  ChessColor,
  PlayerOrientation
} from '../../types';

interface OrientationDetectionResult
  extends PlayerOrientation {
  confidence:
    | 'high'
    | 'medium'
    | 'low';

  reasons: string[];
}

function classText(
  element: Element
): string {
  const className =
    element.getAttribute(
      'class'
    ) ?? '';

  return className
    .toLowerCase();
}

function detectFlipFromBoardClass(
  board: HTMLElement
): boolean | null {
  const classes = classText(board);

  const flippedMarkers = [
    'flipped',
    'orientation-black',
    'black-bottom',
    'board-flipped'
  ];

  for (const marker of flippedMarkers) {
    if (classes.includes(marker)) {
      return true;
    }
  }

  const normalMarkers = [
    'orientation-white',
    'white-bottom'
  ];

  for (const marker of normalMarkers) {
    if (classes.includes(marker)) {
      return false;
    }
  }

  return null;
}

function findCoordinateTexts(
  board: HTMLElement
): HTMLElement[] {
  return Array.from(
    board.querySelectorAll<HTMLElement>(
      [
        '.coordinates',
        '[class*="coordinate"]',
        '[class*="coords"]'
      ].join(',')
    )
  );
}

/**
 * Try detecting orientation using board coordinates.
 *
 * Normal:
 * bottom files = a ... h
 *
 * Flipped:
 * bottom files = h ... a
 */
function detectFlipFromCoordinates(
  board: HTMLElement
): boolean | null {
  const candidates =
    findCoordinateTexts(board);

  if (candidates.length === 0) {
    return null;
  }

  const texts = candidates
    .map((element) => {
      const rawText =
        element.textContent ??
        element.innerText ??
        '';

      return rawText
        .replace(/\s+/g, '')
        .toLowerCase();
    })
    .filter(
      (text) =>
        text.length > 0
    );

  for (const text of texts) {
    if (
      text.includes(
        'abcdefgh'
      )
    ) {
      return false;
    }

    if (
      text.includes(
        'hgfedcba'
      )
    ) {
      return true;
    }
  }

  return null;
}

/**
 * Fallback heuristic:
 *
 * Detect which color's pieces are visually
 * closer to the bottom of the board.
 *
 * This works especially well near the
 * beginning of a bot game.
 */
function detectBottomColorFromPieces(
  board: HTMLElement
): ChessColor | null {
  const boardRect =
    board.getBoundingClientRect();

const localPieces =
  Array.from(
    board.querySelectorAll<HTMLElement>(
      '.piece'
    )
  );

const pieces =
  localPieces.length > 0
    ? localPieces
    : Array.from(
        document.querySelectorAll<HTMLElement>(
          [
            '.piece',
            '[class~="wp"]',
            '[class~="wn"]',
            '[class~="wb"]',
            '[class~="wr"]',
            '[class~="wq"]',
            '[class~="wk"]',
            '[class~="bp"]',
            '[class~="bn"]',
            '[class~="bb"]',
            '[class~="br"]',
            '[class~="bq"]',
            '[class~="bk"]'
          ].join(',')
        )
      ).filter(
        (piece) => {
          const rect =
            piece.getBoundingClientRect();

          const centerX =
            rect.left +
            rect.width / 2;

          const centerY =
            rect.top +
            rect.height / 2;

          return (
            centerX >= boardRect.left &&
            centerX <= boardRect.right &&
            centerY >= boardRect.top &&
            centerY <= boardRect.bottom
          );
        }
      );

  if (pieces.length < 2) {
    return null;
  }

  const whiteY: number[] = [];
  const blackY: number[] = [];

  for (const piece of pieces) {
    const classes =
      classText(piece);

    let color: ChessColor | null =
      null;

    if (
      classes.includes('white')
    ) {
      color = 'w';
    }

    if (
      classes.includes('black')
    ) {
      color = 'b';
    }

    if (!color) {
      continue;
    }

    const rect =
      piece.getBoundingClientRect();

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      continue;
    }

    const centerY =
      rect.top +
      rect.height / 2 -
      boardRect.top;

    const normalizedY =
      centerY /
      boardRect.height;

    if (color === 'w') {
      whiteY.push(normalizedY);
    } else {
      blackY.push(normalizedY);
    }
  }

  if (
    whiteY.length === 0 ||
    blackY.length === 0
  ) {
    return null;
  }

  const average = (
    values: number[]
  ): number =>
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length;

  const whiteAverage =
    average(whiteY);

  const blackAverage =
    average(blackY);

  const difference =
    Math.abs(
      whiteAverage -
      blackAverage
    );

  // Too ambiguous.
  if (difference < 0.08) {
    return null;
  }

  return whiteAverage >
    blackAverage
    ? 'w'
    : 'b';
}

export function detectOrientation(
  board: HTMLElement
): OrientationDetectionResult {
  const reasons: string[] = [];

  //
  // 1. Explicit board class.
  //
  const classFlip =
    detectFlipFromBoardClass(
      board
    );

  if (classFlip !== null) {
    reasons.push(
      `Orientation detected from board class`
    );

    return {
      isFlipped: classFlip,
      myColor:
        classFlip
          ? 'b'
          : 'w',
      confidence: 'high',
      reasons
    };
  }

  //
  // 2. Coordinates.
  //
  const coordinateFlip =
    detectFlipFromCoordinates(
      board
    );

  if (
    coordinateFlip !== null
  ) {
    reasons.push(
      'Orientation detected from board coordinates'
    );

    return {
      isFlipped:
        coordinateFlip,

      myColor:
        coordinateFlip
          ? 'b'
          : 'w',

      confidence: 'high',
      reasons
    };
  }

  //
  // 3. Piece positions.
  //
  const bottomColor =
    detectBottomColorFromPieces(
      board
    );

  if (bottomColor) {
    const flipped =
      bottomColor === 'b';

    reasons.push(
      `Bottom pieces look ${bottomColor === 'w'
        ? 'white'
        : 'black'}`
    );

    return {
      isFlipped: flipped,
      myColor: bottomColor,
      confidence: 'medium',
      reasons
    };
  }

  //
  // 4. Safe development fallback.
  //
  reasons.push(
    'No reliable orientation signal found; defaulting to white'
  );

  return {
    isFlipped: false,
    myColor: 'w',
    confidence: 'low',
    reasons
  };
}