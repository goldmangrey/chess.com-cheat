import { DEFAULT_SETTINGS } from '../shared/constants';
import type { EngineHostRequest, EngineRequest, EngineResponse } from '../shared/messages';

let creatingOffscreen: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  const documentUrl = chrome.runtime.getURL('offscreen.html');
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [documentUrl]
  });
  if (contexts.length > 0) return;
  if (!creatingOffscreen) {
    console.log('[Chess Practice Overlay] creating offscreen document');
    creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Run the local Stockfish chess engine in a dedicated Web Worker'
    }).then(() => {
      console.log('[Chess Practice Overlay] offscreen document ready');
    }).finally(() => {
      creatingOffscreen = null;
    });
  }
  await creatingOffscreen;
}

function toHostRequest(message: EngineRequest): EngineHostRequest {
  switch (message.type) {
    case 'ENGINE_INIT': return { ...message, type: 'OFFSCREEN_ENGINE_INIT' };
    case 'ENGINE_ANALYZE': return { ...message, type: 'OFFSCREEN_ENGINE_ANALYZE' };
    case 'ENGINE_CANCEL': return { ...message, type: 'OFFSCREEN_ENGINE_CANCEL' };
    case 'ENGINE_DESTROY': return { ...message, type: 'OFFSCREEN_ENGINE_DESTROY' };
  }
}

chrome.runtime.onMessage.addListener((message: EngineRequest, _sender, sendResponse) => {
  if (!message.type?.startsWith('ENGINE_')) return false;
  void (async () => {
    try {
      await ensureOffscreenDocument();
      const response = await chrome.runtime.sendMessage<EngineHostRequest, EngineResponse>(toHostRequest(message));
      sendResponse(response);
    } catch (error) {
      sendResponse({ type: 'ENGINE_ERROR', requestId: message.requestId,
        error: error instanceof Error ? error.message : String(error) } satisfies EngineResponse);
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Chess Practice Overlay] Extension installed');
  void chrome.storage.local.get({ arrowsEnabled: DEFAULT_SETTINGS.arrowsEnabled, engineDepth: DEFAULT_SETTINGS.engineDepth })
    .then((stored) => chrome.storage.local.set({ ...DEFAULT_SETTINGS, ...stored }));
});
