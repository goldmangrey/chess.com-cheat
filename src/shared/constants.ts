export const DEFAULT_ENGINE_DEPTH = 12;
export const ENGINE_DEPTH_OPTIONS = [8, 10, 12, 14, 16] as const;
export const POSITION_DEBOUNCE_MS = 60;
export const SESSION_RECHECK_MS = 350;

export interface ExtensionSettings {
  arrowsEnabled: boolean;
  engineDepth: number;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  arrowsEnabled: true,
  engineDepth: DEFAULT_ENGINE_DEPTH
};

export function normalizeSettings(value: Partial<ExtensionSettings> | undefined): ExtensionSettings {
  const requestedDepth = value?.engineDepth;
  const engineDepth = ENGINE_DEPTH_OPTIONS.includes(
    requestedDepth as (typeof ENGINE_DEPTH_OPTIONS)[number]
  ) ? requestedDepth as number : DEFAULT_ENGINE_DEPTH;

  return {
    arrowsEnabled: value?.arrowsEnabled ?? DEFAULT_SETTINGS.arrowsEnabled,
    engineDepth
  };
}
