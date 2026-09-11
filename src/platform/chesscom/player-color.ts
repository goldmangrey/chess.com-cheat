import type {
  ChessColor
} from '../../types';

export interface PlayerColorDetectionResult {
  myColor: ChessColor | null;

  confidence:
    | 'high'
    | 'medium'
    | 'low';

  reasons: string[];
}

export function detectPlayerColor():
  PlayerColorDetectionResult {
  const reasons: string[] = [];

  const bottomClock =
    document.querySelector<HTMLElement>(
      '.clock-component.clock-bottom'
    );

  if (bottomClock) {
    const classes =
      bottomClock
        .getAttribute('class')
        ?.toLowerCase() ?? '';

    if (classes.includes('clock-black')) {
      reasons.push(
        'Bottom player clock is black'
      );

      return {
        myColor: 'b',
        confidence: 'high',
        reasons
      };
    }

    if (classes.includes('clock-white')) {
      reasons.push(
        'Bottom player clock is white'
      );

      return {
        myColor: 'w',
        confidence: 'high',
        reasons
      };
    }
  }

  /*
   * Some Chess.com modes may expose
   * color on the player container itself.
   */
  const bottomPlayer =
    document.querySelector<HTMLElement>(
      '.board-layout-player.board-layout-bottom'
    );

  if (bottomPlayer) {
    const colorElement =
      bottomPlayer.querySelector<HTMLElement>(
        [
          '[class*="clock-white"]',
          '[class*="clock-black"]'
        ].join(',')
      );

    const classes =
      colorElement
        ?.getAttribute('class')
        ?.toLowerCase() ?? '';

    if (classes.includes('clock-black')) {
      return {
        myColor: 'b',
        confidence: 'high',
        reasons: [
          'Bottom player panel contains black clock'
        ]
      };
    }

    if (classes.includes('clock-white')) {
      return {
        myColor: 'w',
        confidence: 'high',
        reasons: [
          'Bottom player panel contains white clock'
        ]
      };
    }
  }

  return {
    myColor: null,
    confidence: 'low',
    reasons: [
      'Could not determine player color from player panel'
    ]
  };
}
