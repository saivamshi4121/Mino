import type { PomodoroConfig } from './moduleEvents'

export type MonitorMode = 'primary' | 'chosen' | 'cursor'
export type DockSide = 'left' | 'center' | 'right'
export type PresenceLevel = 'ghost' | 'glance' | 'summon'

export interface MinoSettings {
  pomodoro: PomodoroConfig
  launcher: {
    aliases: Record<string, string>
  }
  voice: {
    hotkey: string
    wakeWordEnabled: boolean
    microphoneEnabled: boolean
  }
  display: {
    mode: MonitorMode
    displayId: number
  }
  appearance: {
    dock: DockSide
    position: { x: number | null; y: number | null }
    hideFullscreen: boolean
    browserDot: boolean
  }
  soundsEnabled: boolean
  onboardingComplete: boolean
}

export interface DisplayOption {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
}
