import type {
  PositionSnapshot
} from '../../types';

import {
  createPositionSnapshot
} from './fen-builder';

export interface PositionChangeEvent {
  previous: PositionSnapshot;
  current: PositionSnapshot;
}

interface PositionObserverOptions {
  board: HTMLElement;
  isFlipped: boolean;

  /**
   * true  = snapshot confirmed, commit it
   * false = transient/invalid DOM state, ignore it
   */
  onChange: (
    event: PositionChangeEvent
  ) => boolean;

  debounceMs?: number;
}

export class PositionObserver {
  private readonly board: HTMLElement;
  private readonly isFlipped: boolean;

  private readonly onChange: (
    event: PositionChangeEvent
  ) => boolean;

  private readonly debounceMs: number;

  private observer:
    MutationObserver | null =
    null;

  private lastSnapshot:
    PositionSnapshot | null =
    null;

  private frameScheduled =
    false;

  private debounceTimer:
    number | null =
    null;

  private stopped =
    false;

  constructor(
    options: PositionObserverOptions
  ) {
    this.board =
      options.board;

    this.isFlipped =
      options.isFlipped;

    this.onChange =
      options.onChange;

    this.debounceMs =
      options.debounceMs ?? 35;
  }

  start(): void {
    if (this.observer) {
      return;
    }

    this.stopped = false;

    this.lastSnapshot =
      createPositionSnapshot(
        this.board,
        this.isFlipped
      );

    this.observer =
      new MutationObserver(
        () => {
          this.scheduleRead();
        }
      );

    this.observer.observe(
      this.board,
      {
        subtree: true,
        childList: true,
        attributes: true,

        attributeFilter: [
          'class',
          'style',
          'data-square'
        ]
      }
    );

    console.log(
      '[Chess Practice Overlay] PositionObserver started'
    );
  }

  stop(): void {
    this.stopped = true;

    this.observer?.disconnect();
    this.observer = null;

    if (
      this.debounceTimer !== null
    ) {
      clearTimeout(
        this.debounceTimer
      );

      this.debounceTimer =
        null;
    }

    this.frameScheduled =
      false;

    console.log(
      '[Chess Practice Overlay] PositionObserver stopped'
    );
  }

  private scheduleRead(): void {
    if (
      this.stopped ||
      this.frameScheduled
    ) {
      return;
    }

    this.frameScheduled =
      true;

    requestAnimationFrame(
      () => {
        this.frameScheduled =
          false;

        if (
          this.debounceTimer !== null
        ) {
          clearTimeout(
            this.debounceTimer
          );
        }

        this.debounceTimer =
          window.setTimeout(
            () => {
              this.debounceTimer =
                null;

              this.readPosition();
            },
            this.debounceMs
          );
      }
    );
  }

  private readPosition(): void {
    if (
      this.stopped ||
      !this.board.isConnected
    ) {
      return;
    }

    const current =
      createPositionSnapshot(
        this.board,
        this.isFlipped
      );

    const previous =
      this.lastSnapshot;

    if (!previous) {
      this.lastSnapshot =
        current;

      return;
    }

    if (
      current.fingerprint ===
      previous.fingerprint
    ) {
      return;
    }

    /**
     * Important:
     * don't commit before chess.js
     * confirms that this is a real position.
     */
    const accepted =
      this.onChange({
        previous,
        current
      });

    if (accepted) {
      this.lastSnapshot =
        current;
    } else {
      console.debug(
        '[Chess Practice Overlay] Ignored transient board state'
      );
    }
  }
}