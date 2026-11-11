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
