import type {
  Square
} from '../types';

import {
  createArrowDefs,
  drawHint,
  type RookHint
} from './arrows';

export interface DrawBoardHintOptions {
  from: Square;
  to: Square;
  label: string;
  capture?: boolean;
  rook?: RookHint;
}

const SVG_NS =
  'http://www.w3.org/2000/svg';

export class BoardOverlay {
  private readonly board:
    HTMLElement;

  private readonly isFlipped:
    boolean;

  private readonly container:
    HTMLDivElement;

  private readonly svg:
    SVGSVGElement;

  private resizeObserver:
    ResizeObserver | null =
    null;

  private syncScheduled =
    false;

  private destroyed =
    false;

  constructor(
    board: HTMLElement,
    isFlipped: boolean
  ) {
    this.board =
      board;

    this.isFlipped =
      isFlipped;

    this.container =
      document.createElement(
        'div'
      );

    this.container.id =
      'chess-practice-overlay';

    Object.assign(
      this.container.style,
      {
        position:
          'fixed',

        pointerEvents:
          'none',

        zIndex:
          '2147483647',

        margin:
          '0',

        padding:
          '0',

        overflow:
          'visible',

        userSelect:
          'none'
      }
    );

    this.svg =
      document.createElementNS(
        SVG_NS,
        'svg'
      );

    this.svg.setAttribute(
      'viewBox',
      '0 0 8 8'
    );

    this.svg.setAttribute(
      'preserveAspectRatio',
      'none'
    );

    Object.assign(
      this.svg.style,
      {
        width:
          '100%',

        height:
          '100%',

        display:
          'block',

        pointerEvents:
          'none',

        overflow:
          'visible'
      }
    );

    this.container.appendChild(
      this.svg
    );

    document.body.appendChild(
      this.container
    );

    createArrowDefs(
      this.svg
    );

    this.handleScroll =
      this.handleScroll.bind(
        this
      );

    this.handleResize =
      this.handleResize.bind(
        this
      );

    this.resizeObserver =
      new ResizeObserver(
        () => {
          this.scheduleSync();
        }
      );

    this.resizeObserver.observe(
      this.board
    );

    window.addEventListener(
      'scroll',
      this.handleScroll,
      {
        passive: true,
        capture: true
      }
    );

    window.addEventListener(
      'resize',
      this.handleResize
    );

    this.syncNow();

    console.log(
      '[Chess Practice Overlay] BoardOverlay mounted'
    );
  }

  drawHint(
    options:
      DrawBoardHintOptions
  ): void {
    drawHint({
      svg:
        this.svg,

      from:
        options.from,

      to:
        options.to,

      label: options.label,
      capture: options.capture,
      rook: options.rook,

      isFlipped:
        this.isFlipped
    });
  }

  clear(): boolean {
    const hints = this.svg.querySelectorAll('.chess-practice-hint');
    hints.forEach(
        (element) => {
          element.remove();
        }
      );
    return hints.length > 0;
  }

  destroy(): void {
    if (
      this.destroyed
    ) {
      return;
    }

    this.destroyed =
      true;

    this.resizeObserver
      ?.disconnect();

    this.resizeObserver =
      null;

    window.removeEventListener(
      'scroll',
      this.handleScroll,
      true
    );

    window.removeEventListener(
      'resize',
      this.handleResize
    );

    this.container.remove();

    console.log(
      '[Chess Practice Overlay] BoardOverlay destroyed'
    );
  }

  private handleScroll():
    void {
    this.scheduleSync();
  }

  private handleResize():
    void {
    this.scheduleSync();
  }

  private scheduleSync():
    void {
    if (
      this.destroyed ||
      this.syncScheduled
    ) {
      return;
    }

    this.syncScheduled =
      true;

    requestAnimationFrame(
      () => {
        this.syncScheduled =
          false;

        this.syncNow();
      }
    );
  }

  private syncNow():
    void {
    if (
      this.destroyed
    ) {
      return;
    }

    if (
      !this.board.isConnected
    ) {
      this.container.style.display =
        'none';

      return;
    }

    const rect =
      this.board
        .getBoundingClientRect();

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      this.container.style.display =
        'none';

      return;
    }

    this.container.style.display =
      'block';

    this.container.style.left =
      `${rect.left}px`;

    this.container.style.top =
      `${rect.top}px`;

    this.container.style.width =
      `${rect.width}px`;

    this.container.style.height =
      `${rect.height}px`;
  }
}
