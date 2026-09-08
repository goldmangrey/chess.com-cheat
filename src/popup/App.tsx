import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, ENGINE_DEPTH_OPTIONS, normalizeSettings, type ExtensionSettings } from '../shared/constants';
import { EMPTY_RUNTIME_STATE, type ExtensionMessage, type ExtensionRuntimeState, type RuntimeStateResponse } from '../shared/messages';

export default function App() {
  const [runtime, setRuntime] = useState<ExtensionRuntimeState>(EMPTY_RUNTIME_STATE);
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void chrome.storage.local.get({ arrowsEnabled: DEFAULT_SETTINGS.arrowsEnabled, engineDepth: DEFAULT_SETTINGS.engineDepth })
      .then((stored) => setSettings(normalizeSettings(stored)));
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) return;
      try {
        const response = await chrome.tabs.sendMessage<ExtensionMessage, RuntimeStateResponse>(tab.id, { type: 'GET_RUNTIME_STATE' });
        setRuntime(response.state);
      } catch {
        setRuntime({ ...EMPTY_RUNTIME_STATE, error: 'Open a supported Chess.com bot game.' });
      }
    });
    const listener = (message: ExtensionMessage) => {
      if (message.type === 'RUNTIME_STATE_UPDATED') setRuntime(message.state);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  function update(patch: Partial<ExtensionSettings>): void {
    const next = normalizeSettings({ ...settings, ...patch });
    setSettings(next);
    void chrome.storage.local.set(next);
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) return chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings: next } satisfies ExtensionMessage);
      return undefined;
    }).catch(() => undefined);
  }

  const supported = runtime.gameMode === 'BOT' || runtime.gameMode === 'PRACTICE_COMPUTER';
  const sessionText = runtime.active ? 'Active' : supported ? 'Waiting' : 'Unsupported';
  const engineText = runtime.engineStatus === 'thinking' ? 'Thinking'
    : runtime.engineStatus === 'ready' ? 'Ready'
    : runtime.engineStatus === 'error' ? 'Error' : 'Idle';

  return <main className="popup-card">
    <header>
      <div className="brand-mark" aria-hidden="true">♞</div>
      <div><h1>Chess hints</h1><p>Practice assistant</p></div>
    </header>

    <section className="primary-control">
      <div><strong>Best-move hints</strong><span>{settings.arrowsEnabled ? 'ON' : 'OFF'}</span></div>
      <label className="switch">
        <input type="checkbox" checked={settings.arrowsEnabled}
          onChange={(event) => update({ arrowsEnabled: event.target.checked })} />
        <span className="switch-track"><span className="switch-thumb" /></span>
      </label>
    </section>

    <section className="depth-control">
      <div className="section-label"><strong>Engine depth</strong><span>{settings.engineDepth}</span></div>
      <div className="depth-options" role="group" aria-label="Engine depth">
        {ENGINE_DEPTH_OPTIONS.map((depth) => <button key={depth} type="button"
          className={depth === settings.engineDepth ? 'selected' : ''}
          onClick={() => update({ engineDepth: depth })}>{depth}</button>)}
      </div>
    </section>

    <footer>
      <span className={`status-dot ${runtime.engineStatus}`} />
      <span>{sessionText}</span><i>·</i>
      <span>{supported ? `${runtime.gameMode === 'BOT' ? 'BOT' : 'Practice'} mode` : 'No bot game'}</span><i>·</i>
      <span>Engine {engineText}</span>
    </footer>
    {runtime.error && <p className="error" title={runtime.error}>{runtime.error}</p>}
  </main>;
}
