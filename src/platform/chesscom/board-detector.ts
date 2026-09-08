export interface DetectedBoard {
  element: HTMLElement;
  rect: DOMRect;
}

interface BoardCandidate {
  element: HTMLElement;
  rect: DOMRect;
  pieceCount: number;
  viewportScore: number;
  area: number;
}

const BOARD_SELECTORS = [
  'wc-chess-board',
  '#board',
  '.board',
  '[data-board]',
  '[class*="chess-board"]'
];

function isCssVisible(
  element: HTMLElement
): boolean {
  const rect =
    element.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return false;
  }

  const style =
    window.getComputedStyle(
      element
    );

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(
      style.opacity || '1'
    ) > 0
  );
}

/**
 * How much of this element is currently
 * intersecting the browser viewport.
 *
 * 0 = completely outside
 * 1 = completely visible
 */
function getViewportScore(
  rect: DOMRect
): number {
  const viewportWidth =
    window.innerWidth;

  const viewportHeight =
    window.innerHeight;

  const visibleLeft =
    Math.max(
      0,
      rect.left
    );

  const visibleTop =
    Math.max(
      0,
      rect.top
    );

  const visibleRight =
    Math.min(
      viewportWidth,
      rect.right
    );

  const visibleBottom =
    Math.min(
      viewportHeight,
      rect.bottom
    );

  const visibleWidth =
    Math.max(
      0,
      visibleRight -
        visibleLeft
    );

  const visibleHeight =
    Math.max(
      0,
      visibleBottom -
        visibleTop
    );

  const visibleArea =
    visibleWidth *
    visibleHeight;

  const totalArea =
    rect.width *
    rect.height;

  if (totalArea <= 0) {
    return 0;
  }

  return (
    visibleArea /
    totalArea
  );
}

function isSquareBoard(
  element: HTMLElement
): boolean {
  if (
    !isCssVisible(element)
  ) {
    return false;
  }

  const rect =
    element.getBoundingClientRect();

  if (
    rect.width < 200 ||
    rect.height < 200
  ) {
    return false;
  }

  const ratio =
    rect.width /
    rect.height;

  return (
    ratio >= 0.93 &&
    ratio <= 1.07
  );
}

function countPieces(
  element: HTMLElement
): number {
  return element.querySelectorAll(
    '.piece'
  ).length;
}

function collectCandidates():
  HTMLElement[] {
  const result:
    HTMLElement[] = [];

  for (
    const selector
    of BOARD_SELECTORS
  ) {
    const found =
      document.querySelectorAll<HTMLElement>(
        selector
      );

    result.push(
      ...found
    );
  }

  return Array.from(
    new Set(result)
  );
}

/**
 * Chess.com can keep old/offscreen board
 * instances in DOM.
 *
 * Therefore we rank candidates by:
 *
 * 1. contains actual pieces
 * 2. visible in viewport
 * 3. board area
 */
export function detectMainBoard():
  DetectedBoard | null {
  const candidates:
    BoardCandidate[] =
    collectCandidates()
      .filter(
        isSquareBoard
      )
      .map(
        (element) => {
          const rect =
            element
              .getBoundingClientRect();

          return {
            element,
            rect,

            pieceCount:
              countPieces(
                element
              ),

            viewportScore:
              getViewportScore(
                rect
              ),

            area:
              rect.width *
              rect.height
          };
        }
      );

  if (
    candidates.length === 0
  ) {
    return null;
  }

  candidates.sort(
    (a, b) => {
      //
      // Actual chess pieces are
      // the strongest signal.
      //
      if (
        a.pieceCount !==
        b.pieceCount
      ) {
        return (
          b.pieceCount -
          a.pieceCount
        );
      }

      //
      // Prefer currently visible board.
      //
      if (
        a.viewportScore !==
        b.viewportScore
      ) {
        return (
          b.viewportScore -
          a.viewportScore
        );
      }

      //
      // Finally prefer larger board.
      //
      return (
        b.area -
        a.area
      );
    }
  );

  const best =
    candidates[0];

  //
  // Reject completely off-screen
  // stale board instances unless
  // they contain pieces.
  //
  if (
    best.viewportScore === 0 &&
    best.pieceCount === 0
  ) {
    return null;
  }

  return {
    element:
      best.element,

    rect:
      best.rect
  };
}