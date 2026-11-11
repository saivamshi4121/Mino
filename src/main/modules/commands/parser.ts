import type { ActivityCommand, MediaCommand } from '../../../shared/moduleEvents'

export interface LauncherOperation {
  action: 'open' | 'close'
  name: string
}

export type VoiceCommand =
  | { type: 'launcher'; operations: LauncherOperation[] }
  | { type: 'media'; command: MediaCommand }
  | { type: 'activity'; command: ActivityCommand }
  | { type: 'battery.query' }
  | { type: 'volume.set'; level: number }
  | { type: 'volume.mute'; muted: boolean }
  | { type: 'web.search'; provider: 'google' | 'youtube'; query: string }

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
}

function parseSpokenNumber(value: string): number | null {
  const normalized = value.trim().toLowerCase()
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized)
  const words = normalized.split(/[\s-]+/)
  if (words.length === 1) return NUMBER_WORDS[words[0]] ?? null
  if (words.length === 2) {
    const tens = NUMBER_WORDS[words[0]]
    const ones = NUMBER_WORDS[words[1]]
    if (tens !== undefined && tens >= 20 && tens % 10 === 0 && ones !== undefined && ones < 10) {
      return tens + ones
    }
  }
  return null
}

export function parseLauncherCommand(input: string): LauncherOperation[] | null {
  const command = input.trim().match(/^(open|launch|start|close)\s+(.+)$/i)
  if (!command) return null

  const action = command[1].toLowerCase() === 'close' ? 'close' : 'open'
  const names = command[2].split(/\s+and\s+/i).map((name) => name.trim())

  if (names.some((name) => !name || /^and\b|\band$/i.test(name))) return null
  return names.map((name) => ({ action, name }))
}

export function parseVoiceCommand(input: string): VoiceCommand | null {
  const command = input
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, '')
    .trim()
  if (!command) return null

  if (/^(?:what(?:'s| is) my battery|battery status|battery level)$/.test(command)) {
    return { type: 'battery.query' }
  }
  if (/^(?:start focus|start pomodoro)$/.test(command)) {
    return { type: 'activity', command: { type: 'pomodoro.start' } }
  }
  if (/^pause focus$/.test(command)) {
    return { type: 'activity', command: { type: 'pomodoro.pause' } }
  }
  if (/^skip break$/.test(command)) {
    return { type: 'activity', command: { type: 'pomodoro.skip' } }
  }
  if (/^stop focus$/.test(command)) {
    return { type: 'activity', command: { type: 'pomodoro.reset' } }
  }
  if (/^cancel timer$/.test(command)) {
    return { type: 'activity', command: { type: 'timer.cancel' } }
  }

  const timer = command.match(/^set (?:a )?timer for (.+?)\s+(seconds?|minutes?)$/)
  if (timer) {
    const value = parseSpokenNumber(timer[1])
    if (value === null || value <= 0) return null
    const seconds = timer[2].startsWith('minute') ? value * 60 : value
    if (seconds > 24 * 60 * 60) return null
    return { type: 'activity', command: { type: 'timer.start', minutes: seconds / 60 } }
  }

  if (/^(?:play|play music)$/.test(command)) {
    return { type: 'media', command: 'play' }
  }
  if (/^pause(?: music)?$/.test(command)) {
    return { type: 'media', command: 'pause' }
  }
  if (/^(?:next|next song|skip song)$/.test(command)) {
    return { type: 'media', command: 'next' }
  }
  if (/^(?:previous|previous song|last song)$/.test(command)) {
    return { type: 'media', command: 'prev' }
  }
  if (command === 'mute') return { type: 'volume.mute', muted: true }
  if (command === 'unmute') return { type: 'volume.mute', muted: false }

  const volume = command.match(/^volume\s+(\d{1,3})$/)
  if (volume) {
    const level = Number(volume[1])
    return level <= 100 ? { type: 'volume.set', level } : null
  }

  const search = command.match(/^search\s+(.+)\s+on\s+(youtube|google)$/)
  if (search)
    return {
      type: 'web.search',
      query: search[1].trim(),
      provider: search[2] as 'google' | 'youtube'
    }

  const operations = parseLauncherCommand(input)
  return operations ? { type: 'launcher', operations } : null
}
