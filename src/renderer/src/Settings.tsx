import { useEffect, useState } from 'react'
import type { DisplayOption, MinoSettings } from '../../shared/settings'
import './settings.css'

function Settings(): React.JSX.Element {
  const [settings, setSettings] = useState<MinoSettings | null>(null)
  const [displays, setDisplays] = useState<DisplayOption[]>([])
  const [aliasesText, setAliasesText] = useState('')
  const [startupEnabled, setStartupEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([
      window.island.settings.get(),
      window.island.settings.getDisplays(),
      window.island.settings.getStartup()
    ])
      .then(([loadedSettings, loadedDisplays, startup]) => {
        if (!active) return
        setSettings(loadedSettings)
        setAliasesText(JSON.stringify(loadedSettings.launcher.aliases, null, 2))
        setDisplays(loadedDisplays)
        setStartupEnabled(startup)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : String(loadError))
      })
    return () => {
      active = false
    }
  }, [])

  const updateSettings = (update: (current: MinoSettings) => MinoSettings): void => {
    setSettings((current) => (current ? update(current) : current))
  }

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!settings) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const aliases: unknown = JSON.parse(aliasesText)
      if (typeof aliases !== 'object' || aliases === null || Array.isArray(aliases)) {
        throw new TypeError('Aliases must be a JSON object mapping names to app names')
      }
      const saved = await window.island.settings.save({
        ...settings,
        launcher: { aliases: aliases as Record<string, string> }
      })
      setSettings(saved)
      setAliasesText(JSON.stringify(saved.launcher.aliases, null, 2))
      setMessage('Settings saved')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setSaving(false)
    }
  }

  const setStartup = async (enabled: boolean): Promise<void> => {
    setError('')
    try {
      setStartupEnabled(await window.island.settings.setStartup(enabled))
    } catch (startupError) {
      setError(startupError instanceof Error ? startupError.message : String(startupError))
    }
  }

  if (!settings) {
    return (
      <main className="settings-window">
        <p>{error || 'Loading settings…'}</p>
        <button className="settings-close" onClick={() => window.close()}>
          Close
        </button>
      </main>
    )
  }

  const monitorValue =
    settings.display.mode === 'chosen'
      ? `chosen:${settings.display.displayId}`
      : settings.display.mode

  return (
    <main className="settings-window">
      <header className="settings-header">
        <div>
          <p className="settings-eyebrow">MINO</p>
          <h1>Settings</h1>
        </div>
        <button
          className="settings-close"
          aria-label="Close settings"
          onClick={() => window.close()}
        >
          ×
        </button>
      </header>
      <form onSubmit={save}>
        <section className="settings-section">
          <h2>Voice</h2>
          <label className="settings-field">
            <span>Hotkey</span>
            <input
              value={settings.voice.hotkey}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  voice: { ...current.voice, hotkey: event.target.value }
                }))
              }
            />
          </label>
          <label className="settings-toggle">
            <span>Wake word enabled</span>
            <input
              type="checkbox"
              checked={settings.voice.wakeWordEnabled}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  voice: { ...current.voice, wakeWordEnabled: event.target.checked }
                }))
              }
            />
          </label>
          <label className="settings-toggle">
            <span>Microphone enabled</span>
            <input
              type="checkbox"
              checked={settings.voice.microphoneEnabled}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  voice: { ...current.voice, microphoneEnabled: event.target.checked }
                }))
              }
            />
          </label>
        </section>

        <section className="settings-section">
          <h2>Pomodoro</h2>
          {(
            [
              ['focusMinutes', 'Focus minutes'],
              ['breakMinutes', 'Break minutes'],
              ['longBreakMinutes', 'Long break minutes'],
              ['roundsUntilLongBreak', 'Rounds before long break']
            ] as const
          ).map(([key, label]) => (
            <label className="settings-field settings-field--number" key={key}>
              <span>{label}</span>
              <input
                type="number"
                min={1}
                max={120}
                step={1}
                value={settings.pomodoro[key]}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    pomodoro: {
                      ...current.pomodoro,
                      [key]: Number(event.target.value)
                    }
                  }))
                }
              />
            </label>
          ))}
        </section>

        <section className="settings-section">
          <h2>Launcher aliases</h2>
          <label className="settings-field">
            <span>JSON object mapping aliases to app names</span>
            <textarea
              rows={5}
              spellCheck={false}
              value={aliasesText}
              onChange={(event) => setAliasesText(event.target.value)}
            />
          </label>
        </section>

        <section className="settings-section">
          <h2>Presence</h2>
          <label className="settings-field">
            <span>Glance pill dock</span>
            <select
              value={settings.appearance.dock}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  appearance: {
                    ...current.appearance,
                    dock: event.target.value as MinoSettings['appearance']['dock']
                  }
                }))
              }
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="settings-toggle">
            <span>Hide island over fullscreen apps</span>
            <input
              type="checkbox"
              checked={settings.appearance.hideFullscreen}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  appearance: {
                    ...current.appearance,
                    hideFullscreen: event.target.checked
                  }
                }))
              }
            />
          </label>
          <label className="settings-toggle">
            <span>Use dot style over browsers</span>
            <input
              type="checkbox"
              checked={settings.appearance.browserDot}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  appearance: {
                    ...current.appearance,
                    browserDot: event.target.checked
                  }
                }))
              }
            />
          </label>
        </section>

        <section className="settings-section">
          <h2>Display and sound</h2>
          <label className="settings-field">
            <span>Island monitor</span>
            <select
              value={monitorValue}
              onChange={(event) => {
                const [mode, id] = event.target.value.split(':')
                updateSettings((current) => ({
                  ...current,
                  display: {
                    mode: mode as MinoSettings['display']['mode'],
                    displayId: id ? Number(id) : current.display.displayId
                  }
                }))
              }}
            >
              <option value="primary">Primary display</option>
              <option value="cursor">Display under cursor</option>
              {displays.map((display) => (
                <option key={display.id} value={`chosen:${display.id}`}>
                  {display.label}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-toggle">
            <span>Expand/collapse sounds</span>
            <input
              type="checkbox"
              checked={settings.soundsEnabled}
              onChange={(event) =>
                updateSettings((current) => ({ ...current, soundsEnabled: event.target.checked }))
              }
            />
          </label>
          <label className="settings-toggle">
            <span>Start with Windows</span>
            <input
              type="checkbox"
              checked={startupEnabled}
              onChange={(event) => void setStartup(event.target.checked)}
            />
          </label>
        </section>

        {error && <p className="settings-message settings-message--error">{error}</p>}
        {message && <p className="settings-message">{message}</p>}
        <footer className="settings-footer">
          <button type="submit" className="settings-save" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </footer>
      </form>
    </main>
  )
}

export default Settings
