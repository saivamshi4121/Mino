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

export type IslandModuleEvent =
  | {
      type: 'battery.update'
      payload: {
        percent: number | null
        charging: boolean
      }
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
