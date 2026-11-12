import type { MinoSettings } from './settings'

export interface AlertPayload {
  title: string
  message?: string
  type?: 'info' | 'warning' | 'success' | 'error'
}

export interface PomodoroConfig {
  focusMinutes: number
  breakMinutes: number
  longBreakMinutes: number
  roundsUntilLongBreak: number
}

export interface PomodoroStats {
  date: string
  completedRounds: number
}

export type ActivityCommand =
  | { type: 'timer.start'; minutes: number }
  | { type: 'timer.resume' }
  | { type: 'timer.pause' }
  | { type: 'timer.cancel' }
  | { type: 'pomodoro.start' }
  | { type: 'pomodoro.pause' }
  | { type: 'pomodoro.skip' }
  | { type: 'pomodoro.reset' }

export type MediaStatus = 'Playing' | 'Paused' | 'Stopped' | 'None'

export interface MediaInfo {
  title: string
  artist: string
  status: MediaStatus
}

export type MediaCommand = 'play' | 'pause' | 'next' | 'prev'

export interface LauncherResult {
  ok: boolean
  matched: string | null
  reason: string | null
  notFound?: boolean
}

export interface LauncherOperationResult extends LauncherResult {
  action: 'open' | 'close'
}

export interface LauncherCommandResult {
  ok: boolean
  reason: string | null
  results: LauncherOperationResult[]
}

export interface LauncherStatus {
  phase: 'opening' | 'opened' | 'closing' | 'closed' | 'failed'
  name: string
  iconDataUrl?: string
  message?: string
  errorTitle?: string
}

export interface VoiceCommandResult {
  ok: boolean
  title: string
  message?: string
  type: 'info' | 'success' | 'error'
}

export type IslandModuleEvent =
  | {
      type: 'battery.update'
      payload: {
        percent: number | null
        charging: boolean
      }
    }
  | {
      type: 'media.update'
      payload: MediaInfo
    }
  | {
      type: 'ALERT'
      payload: AlertPayload
    }
  | {
      type: 'activity.command'
      payload: ActivityCommand
    }
  | {
      type: 'pomodoro.stats'
      payload: PomodoroStats
    }
  | {
      type: 'launcher.status'
      payload: LauncherStatus
    }
  | {
      type: 'voice.listen'
    }
  | { type: 'settings.updated'; payload: MinoSettings }
