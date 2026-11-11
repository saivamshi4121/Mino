import type {
  IslandModuleEvent,
  PomodoroConfig,
  PomodoroStats,
  MediaCommand,
  LauncherCommandResult,
  VoiceCommandResult
} from '../shared/moduleEvents'

declare global {
  interface Window {
    island: {
      setHover: (hovering: boolean) => void
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
        getConfig: () => Promise<{ wakeWordEnabled: boolean }>
        runCommand: (command: string) => Promise<VoiceCommandResult>
      }
      launcher: {
        run: (command: string) => Promise<LauncherCommandResult>
        refresh: () => Promise<void>
      }
      getPomodoroConfig: () => Promise<PomodoroConfig>
      getPomodoroStats: () => Promise<PomodoroStats>
      recordPomodoroRound: () => Promise<PomodoroStats>
    }
  }
}

export {}
