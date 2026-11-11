import type {
  IslandModuleEvent,
  PomodoroConfig,
  PomodoroStats,
  MediaCommand,
  LauncherCommandResult,
  VoiceCommandResult
} from '../shared/moduleEvents'
import type { DisplayOption, MinoSettings, PresenceLevel } from '../shared/settings'
import type { DragPosition, PresenceEvent } from '../shared/presence'

declare global {
  interface Window {
    island: {
      setHover: (hovering: boolean) => void
      presence: {
        setLevel: (level: PresenceLevel) => void
        onEvent: (callback: (event: PresenceEvent) => void) => () => void
        drag: (phase: 'start' | 'move' | 'end', position?: DragPosition) => void
      }
      onModuleEvent: (callback: (event: IslandModuleEvent) => void) => () => void
      timer: {
        start: (minutes: number) => Promise<void>
        resume: () => Promise<void>
        pause: () => Promise<void>
        cancel: () => Promise<void>
      }
      pomodoro: {
        start: () => Promise<void>
        pause: () => Promise<void>
        skip: () => Promise<void>
        reset: () => Promise<void>
      }
      media: {
        command: (cmd: MediaCommand) => Promise<void>
      }
      voice: {
        isModelAvailable: () => Promise<boolean>
        getModelUrl: () => Promise<string>
        getConfig: () => Promise<{ wakeWordEnabled: boolean; microphoneEnabled: boolean }>
        runCommand: (command: string) => Promise<VoiceCommandResult>
      }
      launcher: {
        run: (command: string) => Promise<LauncherCommandResult>
        refresh: () => Promise<void>
      }
      getPomodoroConfig: () => Promise<PomodoroConfig>
      getPomodoroStats: () => Promise<PomodoroStats>
      recordPomodoroRound: () => Promise<PomodoroStats>
      settings: {
        get: () => Promise<MinoSettings>
        getDisplays: () => Promise<DisplayOption[]>
        save: (settings: MinoSettings) => Promise<MinoSettings>
        completeOnboarding: () => Promise<MinoSettings>
        getStartup: () => Promise<boolean>
        setStartup: (enabled: boolean) => Promise<boolean>
        open: () => Promise<void>
      }
    }
  }
}

export {}
