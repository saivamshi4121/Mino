import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import defaults from '../../config/default.json'
import type { MinoSettings } from '../shared/settings'

const defaultSettings: MinoSettings = {
  ...defaults,
  voice: {
    ...defaults.voice,
    microphoneEnabled: true
  },
  display: {
    mode: 'primary',
    displayId: 0
  },
  appearance: {
    dock: 'center',
    position: { x: null, y: null },
    hideFullscreen: true,
    browserDot: true
  },
  soundsEnabled: false,
  onboardingComplete: false
}

let settings: MinoSettings
let settingsPath: string

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeSettings(value: unknown): MinoSettings {
  if (!isRecord(value)) throw new TypeError('Settings must be a JSON object')
  const section = (key: string): Record<string, unknown> => {
    const sectionValue = value[key]
    if (sectionValue === undefined) return {}
    if (!isRecord(sectionValue)) throw new TypeError(`${key} settings must be a JSON object`)
    return sectionValue
  }
  const pomodoro = section('pomodoro')
  const launcher = section('launcher')
  const voice = section('voice')
  const display = section('display')
  const appearance = section('appearance')
  const aliasesValue = launcher.aliases ?? defaultSettings.launcher.aliases
  if (!isRecord(aliasesValue)) throw new TypeError('Launcher aliases must be a JSON object')
  const aliases = aliasesValue
  const normalizedAliases: Record<string, string> = {}

  for (const [alias, target] of Object.entries(aliases)) {
    if (typeof target !== 'string' || !alias.trim() || !target.trim()) {
      throw new TypeError('Launcher aliases must map non-empty names to non-empty app names')
    }
    normalizedAliases[alias.trim()] = target.trim()
  }

  const mode = display.mode ?? defaultSettings.display.mode
  if (mode !== 'primary' && mode !== 'chosen' && mode !== 'cursor') {
    throw new TypeError('Monitor mode must be primary, chosen, or cursor')
  }

  const pomodoroNumber = (key: string, fallback: number): number => {
    const number = pomodoro[key] ?? fallback
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 1 || number > 120) {
      throw new RangeError('Pomodoro durations and rounds must be whole numbers from 1 to 120')
    }
    return number
  }
  const focusMinutes = pomodoroNumber('focusMinutes', defaultSettings.pomodoro.focusMinutes)
  const breakMinutes = pomodoroNumber('breakMinutes', defaultSettings.pomodoro.breakMinutes)
  const longBreakMinutes = pomodoroNumber(
    'longBreakMinutes',
    defaultSettings.pomodoro.longBreakMinutes
  )
  const roundsUntilLongBreak = pomodoroNumber(
    'roundsUntilLongBreak',
    defaultSettings.pomodoro.roundsUntilLongBreak
  )

  const hotkey = voice.hotkey ?? defaultSettings.voice.hotkey
  if (typeof hotkey !== 'string' || !hotkey.trim() || hotkey.length > 100) {
    throw new TypeError('Voice hotkey must be a non-empty accelerator')
  }
  const displayId = display.displayId ?? defaultSettings.display.displayId
  if (typeof displayId !== 'number' || !Number.isSafeInteger(displayId)) {
    throw new TypeError('Monitor ID must be an integer')
  }
  const dock = appearance.dock ?? defaultSettings.appearance.dock
  if (dock !== 'left' && dock !== 'center' && dock !== 'right') {
    throw new TypeError('Island dock must be left, center, or right')
  }
  const positionValue = appearance.position ?? defaultSettings.appearance.position
  if (!isRecord(positionValue)) throw new TypeError('Island position must be an object')
  const x = positionValue.x ?? null
  const y = positionValue.y ?? null
  if (
    (x !== null && (typeof x !== 'number' || !Number.isSafeInteger(x))) ||
    (y !== null && (typeof y !== 'number' || !Number.isSafeInteger(y)))
  ) {
    throw new TypeError('Island position coordinates must be integers or null')
  }
  const hideFullscreen = appearance.hideFullscreen ?? defaultSettings.appearance.hideFullscreen
  const browserDot = appearance.browserDot ?? defaultSettings.appearance.browserDot
  const wakeWordEnabled = voice.wakeWordEnabled ?? defaultSettings.voice.wakeWordEnabled
  const microphoneEnabled = voice.microphoneEnabled ?? defaultSettings.voice.microphoneEnabled
  const soundsEnabled = value.soundsEnabled ?? defaultSettings.soundsEnabled
  const onboardingComplete = value.onboardingComplete ?? defaultSettings.onboardingComplete
  if (
    typeof wakeWordEnabled !== 'boolean' ||
    typeof microphoneEnabled !== 'boolean' ||
    typeof hideFullscreen !== 'boolean' ||
    typeof browserDot !== 'boolean' ||
    typeof soundsEnabled !== 'boolean' ||
    typeof onboardingComplete !== 'boolean'
  ) {
    throw new TypeError('Voice, sound, and onboarding settings must be boolean')
  }

  return {
    pomodoro: { focusMinutes, breakMinutes, longBreakMinutes, roundsUntilLongBreak },
    launcher: { aliases: normalizedAliases },
    voice: {
      hotkey: hotkey.trim(),
      wakeWordEnabled,
      microphoneEnabled
    },
    display: { mode, displayId },
    appearance: {
      dock,
      position: { x, y },
      hideFullscreen,
      browserDot
    },
    soundsEnabled,
    onboardingComplete
  }
}

export function loadSettings(): MinoSettings {
  settingsPath = join(app.getPath('userData'), 'config.json')
  if (!existsSync(settingsPath)) {
    settings = defaultSettings
    saveSettings(settings)
    return settings
  }

  try {
    const stored = JSON.parse(readFileSync(settingsPath, 'utf8')) as unknown
    settings = normalizeSettings(stored)
  } catch (error) {
    console.error('[settings] Could not load user config; using defaults', error)
    settings = defaultSettings
  }
  return settings
}

export function getSettings(): MinoSettings {
  if (!settings) return loadSettings()
  return settings
}

export function saveSettings(value: unknown): MinoSettings {
  const next = normalizeSettings(value)
  if (!settingsPath) settingsPath = join(app.getPath('userData'), 'config.json')
  mkdirSync(dirname(settingsPath), { recursive: true })
  const temporaryPath = `${settingsPath}.tmp`
  writeFileSync(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  renameSync(temporaryPath, settingsPath)
  settings = next
  return settings
}
