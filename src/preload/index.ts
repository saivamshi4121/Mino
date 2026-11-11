import { contextBridge, ipcRenderer } from 'electron'
import type {
  IslandModuleEvent,
  PomodoroConfig,
  PomodoroStats,
  MediaCommand,
  LauncherCommandResult,
  VoiceCommandResult
} from '../shared/moduleEvents'
import type { DisplayOption, MinoSettings, PresenceLevel } from '../shared/settings'
import type { PresenceEvent } from '../shared/presence'

const island = {
  /** Tell main process whether the mouse is over the pill */
  setHover: (hovering: boolean): void => {
    ipcRenderer.send('island:hover', hovering)
  },
  presence: {
    setLevel: (level: PresenceLevel): void => {
      ipcRenderer.send('island:presence-level', level)
    },
    onEvent: (callback: (event: PresenceEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: PresenceEvent): void => {
        callback(data)
      }
      ipcRenderer.on('island:presence-event', listener)
      return () => ipcRenderer.removeListener('island:presence-event', listener)
    },
    drag: (
      phase: 'start' | 'move' | 'end',
      position?: { screenX: number; screenY: number; offsetX: number; offsetY: number }
    ): void => {
      ipcRenderer.send('island:drag', phase, position)
    }
  },
  onModuleEvent: (callback: (event: IslandModuleEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: IslandModuleEvent): void => {
      callback(data)
    }
    ipcRenderer.on('island:module-event', listener)
    return () => ipcRenderer.removeListener('island:module-event', listener)
  },
  timer: {
    start: (minutes: number): Promise<void> =>
      ipcRenderer.invoke('island:activity-command', { type: 'timer.start', minutes }),
    resume: (): Promise<void> =>
      ipcRenderer.invoke('island:activity-command', { type: 'timer.resume' }),
    pause: (): Promise<void> =>
      ipcRenderer.invoke('island:activity-command', { type: 'timer.pause' }),
    cancel: (): Promise<void> =>
      ipcRenderer.invoke('island:activity-command', { type: 'timer.cancel' })
  },
  pomodoro: {
    start: (): Promise<void> =>
      ipcRenderer.invoke('island:activity-command', { type: 'pomodoro.start' }),
    pause: (): Promise<void> =>
      ipcRenderer.invoke('island:activity-command', { type: 'pomodoro.pause' }),
    skip: (): Promise<void> =>
      ipcRenderer.invoke('island:activity-command', { type: 'pomodoro.skip' }),
    reset: (): Promise<void> =>
      ipcRenderer.invoke('island:activity-command', { type: 'pomodoro.reset' })
  },
  media: {
    command: (cmd: MediaCommand): Promise<void> => ipcRenderer.invoke('island:media-command', cmd)
  },
  voice: {
    isModelAvailable: (): Promise<boolean> => ipcRenderer.invoke('island:voice:model-available'),
    getModelUrl: (): Promise<string> => ipcRenderer.invoke('island:voice:model-url'),
    getConfig: (): Promise<{ wakeWordEnabled: boolean; microphoneEnabled: boolean }> =>
      ipcRenderer.invoke('island:voice:config'),
    runCommand: (command: string): Promise<VoiceCommandResult> =>
      ipcRenderer.invoke('island:voice:run-command', command)
  },
  launcher: {
    run: (command: string): Promise<LauncherCommandResult> =>
      ipcRenderer.invoke('island:launcher:run', command),
    refresh: (): Promise<void> => ipcRenderer.invoke('island:launcher:refresh')
  },
  getPomodoroConfig: (): Promise<PomodoroConfig> => ipcRenderer.invoke('island:pomodoro:config'),
  getPomodoroStats: (): Promise<PomodoroStats> => ipcRenderer.invoke('island:pomodoro:stats:get'),
  recordPomodoroRound: (): Promise<PomodoroStats> =>
    ipcRenderer.invoke('island:pomodoro:stats:complete'),
  settings: {
    get: (): Promise<MinoSettings> => ipcRenderer.invoke('island:settings:get'),
    getDisplays: (): Promise<DisplayOption[]> => ipcRenderer.invoke('island:settings:displays'),
    save: (settings: MinoSettings): Promise<MinoSettings> =>
      ipcRenderer.invoke('island:settings:save', settings),
    completeOnboarding: (): Promise<MinoSettings> =>
      ipcRenderer.invoke('island:settings:onboarding-complete'),
    getStartup: (): Promise<boolean> => ipcRenderer.invoke('island:settings:startup:get'),
    setStartup: (enabled: boolean): Promise<boolean> =>
      ipcRenderer.invoke('island:settings:startup', enabled),
    open: (): Promise<void> => ipcRenderer.invoke('island:settings:open')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('island', island)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.island = island
}
