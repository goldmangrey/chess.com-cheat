import type {
  FenPiece,
  ParsedPiece,
  Square
} from '../../types';

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

const PIECE_CLASS_MAP:
  Record<string, FenPiece> = {
    wp: 'P',
    wn: 'N',
    wb: 'B',
    wr: 'R',
    wq: 'Q',
    wk: 'K',

    bp: 'p',
    bn: 'n',
    bb: 'b',
    br: 'r',
    bq: 'q',
    bk: 'k'
  };

function isValidSquare(
  value: string
): value is Square {
  return /^[a-h][1-8]$/.test(value);
}

function detectPieceFromClasses(
  element: HTMLElement
): FenPiece | null {
  const dataPiece =
    element.getAttribute(
      'data-piece'
    )?.toLowerCase();

  if (
    dataPiece &&
    PIECE_CLASS_MAP[
      dataPiece
    ]
  ) {
    return PIECE_CLASS_MAP[
      dataPiece
    ];
  }
  const classes =
    Array.from(
      element.classList
    ).map((value) =>
      value.toLowerCase()
    );

  //
  // Strategy 1:
  // Chess.com style:
  // wp / wn / bk etc.
  //
  for (
    const [
      className,
      piece
    ] of Object.entries(
      PIECE_CLASS_MAP
    )
  ) {
    if (
      classes.includes(
        className
      )
    ) {
      return piece;
    }
  }

  //
  // Strategy 2:
  // white knight
  // black queen
  //
  const white =
    classes.includes('white');

  const black =
    classes.includes('black');

  if (!white && !black) {
    return null;
  }

  const color =
    white ? 'w' : 'b';

  const names:
    Record<string, string> = {
      pawn: 'p',
      knight: 'n',
      bishop: 'b',
      rook: 'r',
      queen: 'q',
      king: 'k'
    };

  for (
    const [
      name,
      short
    ] of Object.entries(names)
  ) {
    if (
      classes.includes(name)
    ) {
      const piece =
        color === 'w'
          ? short.toUpperCase()
          : short;

      return piece as FenPiece;
    }
  }

  return null;
}

/**
 * Chess.com commonly uses classes like:
 *
 * square-11
 * square-52
 *
 * where:
 *
 * first digit = file
 * second digit = rank
 *
 * 1 = a
 * 2 = b
 * ...
 * 8 = h
 */
function detectSquareFromClass(
  element: HTMLElement
): Square | null {
  for (
    const className
    of element.classList
  ) {
    const match =
      className.match(
        /^square-([1-8])([1-8])$/
      );

    if (!match) {
      continue;
    }

    const fileIndex =
      Number(match[1]) - 1;

    const rank =
      Number(match[2]);

    const file =
      FILES[fileIndex];

    const square =
      `${file}${rank}`;

    if (
      isValidSquare(square)
    ) {
      return square;
    }
  }

  return null;
}

function detectSquareFromDataset(
  element: HTMLElement
): Square | null {
  const candidates = [
    element.dataset.square,
    element.dataset.position,
    element.getAttribute(
      'data-square'
    )
  ];

  for (
    const candidate
    of candidates
  ) {
    if (
      candidate &&
      isValidSquare(
        candidate.toLowerCase()
      )
    ) {
      return candidate
        .toLowerCase() as Square;
    }
  }

  return null;
}

/**
 * Generic fallback.
 *
 * We determine which visual cell
 * the centre of the piece occupies.
 *
 * Then compensate for board flip.
 */
function detectSquareFromGeometry(
  board: HTMLElement,
  piece: HTMLElement,
  isFlipped: boolean
): Square | null {
  const boardRect =
    board.getBoundingClientRect();

  const pieceRect =
    piece.getBoundingClientRect();

  if (
    boardRect.width <= 0 ||
    boardRect.height <= 0 ||
    pieceRect.width <= 0 ||
    pieceRect.height <= 0
  ) {
    return null;
  }

  const centerX =
    pieceRect.left +
    pieceRect.width / 2 -
    boardRect.left;

  const centerY =
    pieceRect.top +
    pieceRect.height / 2 -
    boardRect.top;

  const cellWidth =
    boardRect.width / 8;

  const cellHeight =
    boardRect.height / 8;

  let visualFile =
    Math.floor(
      centerX /
      cellWidth
    );

  let visualRank =
    Math.floor(
      centerY /
      cellHeight
    );

  visualFile =
    Math.max(
      0,
      Math.min(
        7,
        visualFile
      )
    );

  visualRank =
    Math.max(
      0,
      Math.min(
        7,
        visualRank
      )
    );

  let canonicalFile: number;
  let canonicalRank: number;

  if (!isFlipped) {
    canonicalFile =
      visualFile;

    canonicalRank =
      8 - visualRank;
  } else {
    canonicalFile =
      7 - visualFile;

    canonicalRank =
      visualRank + 1;
  }

  const file =
    FILES[
      canonicalFile
    ];

  const square =
    `${file}${canonicalRank}`;

  if (
    !isValidSquare(square)
  ) {
    return null;
  }

  return square;
}

function isInsideBoard(
  board: HTMLElement,
  element: HTMLElement
): boolean {
  const boardRect =
    board.getBoundingClientRect();

  const rect =
    element.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return false;
  }

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

function findPieceElements(
  board: HTMLElement
): HTMLElement[] {
  const selectors = [
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
    '[class~="bk"]',

    '[data-piece]'
  ];

  //
  // First try descendants of the board.
  //
  const local =
    Array.from(
      board.querySelectorAll<HTMLElement>(
        selectors.join(',')
      )
    );

  if (local.length > 0) {
    return Array.from(
      new Set(local)
    );
  }

  //
  // Current Chess.com layouts may render
  // the piece layer beside/above #board
  // instead of literally inside it.
  //
  const global =
    Array.from(
      document.querySelectorAll<HTMLElement>(
        selectors.join(',')
      )
    );

  return Array.from(
    new Set(global)
  ).filter(
    (element) =>
      isInsideBoard(
        board,
        element
      )
  );
}

export function parsePieces(
  board: HTMLElement,
  isFlipped: boolean
): ParsedPiece[] {
  const elements =
    findPieceElements(
      board
    );

  const parsed:
    ParsedPiece[] = [];

  for (
    const element
    of elements
  ) {
    const piece =
      detectPieceFromClasses(
        element
      );

    if (!piece) {
      continue;
    }

    const square =
      detectSquareFromDataset(
        element
      ) ??
      detectSquareFromClass(
        element
      ) ??
      detectSquareFromGeometry(
        board,
        element,
        isFlipped
      );

    if (!square) {
      continue;
    }

    parsed.push({
      square,
      piece,
      element
    });
  }

  return parsed;
}