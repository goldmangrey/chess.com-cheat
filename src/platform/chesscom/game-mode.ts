import type {
  GameModeResult
} from '../../types';

const BOT_PATH_PATTERN = /^\/play\/computer(?:\/|$)/i;

const PRACTICE_URL_PATTERNS = [
  /\/practice(?:\/|$|\?)/i,
  /\/practice\/custom(?:\/|$|\?)/i
];

/**
 * Text markers are intentionally used only as
 * secondary evidence.
 *
 * Chess.com may change UI text/classes,
 * so URL + several DOM signals are preferred.
 */
const BOT_TEXT_MARKERS = [
  'play bots',
  'play computer',
  'vs computer',
  'against computer',
  'change bot',
  'choose bot'
];

const PRACTICE_TEXT_MARKERS = [
  'practice vs computer',
  'finish vs bot',
  'switch sides',
  'change bot'
];

const HUMAN_TEXT_MARKERS = [
  'draw',
  'resign',
  'offer draw'
];

function normalizeText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function currentPageText(): string {
  return normalizeText(
    document.body?.innerText ?? ''
  );
}

function matchesAny(
  value: string,
  patterns: RegExp[]
): boolean {
  return patterns.some((pattern) =>
    pattern.test(value)
  );
}

function containsAnyText(
  pageText: string,
  markers: string[]
): string[] {
  return markers.filter((marker) =>
    pageText.includes(marker)
  );
}

function hasBotLikeElement(): boolean {
  const selectors = [
    '[class*="bot"]',
    '[data-cy*="bot"]',
    '[data-testid*="bot"]',
    '[aria-label*="bot" i]',
    '[aria-label*="computer" i]'
  ];

  return selectors.some((selector) => {
    try {
      return document.querySelector(selector) !== null;
    } catch {
      return false;
    }
  });
}

function hasPracticeLikeElement(): boolean {
  const selectors = [
    '[class*="practice"]',
    '[data-cy*="practice"]',
    '[data-testid*="practice"]',
    '[aria-label*="practice" i]',
    '[title*="practice" i]'
  ];

  return selectors.some((selector) => {
    try {
      return document.querySelector(selector) !== null;
    } catch {
      return false;
    }
  });
}

/**
 * We deliberately fail closed.
 *
 * UNKNOWN => no live hints.
 *
 * That prevents accidentally enabling analysis
 * during games against human opponents.
 */
export function detectGameMode(): GameModeResult {
  const url = window.location.href;
  const pathname = window.location.pathname;

  const reasons: string[] = [];

  //
  // 1. Strongest signal: direct bot URL.
  //
  if (
    BOT_PATH_PATTERN.test(pathname)
  ) {
    reasons.push(
      `Matched bot URL: ${pathname}`
    );

    console.log(
      '[Chess Practice Overlay] Gate: detected bot mode, allowing'
    );

    return {
      mode: 'BOT',
      liveHintsAllowed: true,
      confidence: 'high',
      reasons
    };
  }

  // Reading body.innerText is unnecessary for the authoritative bot route
  // and is intentionally deferred until weaker detection paths need it.
  const pageText = currentPageText();

  //
  // 2. Practice page.
  //
  if (
    matchesAny(pathname, PRACTICE_URL_PATTERNS) ||
    matchesAny(url, PRACTICE_URL_PATTERNS)
  ) {
    reasons.push(
      `Matched practice URL: ${pathname}`
    );

    const practiceText =
      containsAnyText(
        pageText,
        PRACTICE_TEXT_MARKERS
      );

    const practiceElement =
      hasPracticeLikeElement();

    if (practiceText.length > 0) {
      reasons.push(
        `Practice text: ${practiceText.join(', ')}`
      );
    }

    if (practiceElement) {
      reasons.push(
        'Practice-like DOM element found'
      );
    }

    const confirmed = practiceText.length > 0 && (practiceElement || hasBotLikeElement());
    if (confirmed) {
      console.log(
        '[Chess Practice Overlay] Gate: detected practice mode, allowing'
      );

      return { mode: 'PRACTICE_COMPUTER', liveHintsAllowed: true, confidence: 'high', reasons };
    }
    reasons.push('Computer opponent is not confirmed');

    console.log(
      '[Chess Practice Overlay] Gate: unknown mode, blocking'
    );

    return { mode: 'UNKNOWN', liveHintsAllowed: false, confidence: 'low', reasons };
  }

  //
  // 3. DOM-based bot detection.
  //
  const botText =
    containsAnyText(
      pageText,
      BOT_TEXT_MARKERS
    );

  const botElement =
    hasBotLikeElement();

  if (
    botElement &&
    botText.length > 0
  ) {
    reasons.push(
      'Bot-like DOM element found'
    );

    reasons.push(
      `Bot text: ${botText.join(', ')}`
    );

    console.log(
      '[Chess Practice Overlay] Gate: detected bot mode, allowing'
    );

    return {
      mode: 'BOT',
      liveHintsAllowed: true,
      confidence: 'medium',
      reasons
    };
  }

  //
  // 4. Human-looking UI is NOT enough
  // to claim HUMAN with high confidence,
  // because bot games can share UI controls.
  //
  const humanText =
    containsAnyText(
      pageText,
      HUMAN_TEXT_MARKERS
    );

  if (humanText.length > 0) {
    reasons.push(
      `Human-game-like controls found: ${humanText.join(', ')}`
    );

    console.log(
      '[Chess Practice Overlay] Gate: detected human game, blocking'
    );

    return {
      mode: 'HUMAN',
      liveHintsAllowed: false,
      confidence: 'low',
      reasons
    };
  }

  //
  // 5. Unknown = disabled.
  //
  reasons.push(
    'No reliable bot/practice signals detected'
  );

  console.log(
    '[Chess Practice Overlay] Gate: unknown mode, blocking'
  );

  return {
    mode: 'UNKNOWN',
    liveHintsAllowed: false,
    confidence: 'low',
    reasons
  };
}

export function canUseLiveHints(): boolean {
  return detectGameMode().liveHintsAllowed;
}
