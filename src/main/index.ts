import { app, BrowserWindow, globalShortcut, ipcMain, screen, session } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { loadModules, type ModuleEmitter } from './modules'
import { sendMediaCommand } from './modules/media'
import type { IslandModuleEvent } from '../shared/moduleEvents'
import type { ActivityCommand, MediaCommand } from '../shared/moduleEvents'
import defaultConfig from '../../config/default.json'
import { getTodayPomodoroStats, recordPomodoroRound } from './modules/pomodoroStats'
import {
  initializeLauncher,
  refreshAppIndex,
  runLauncherCommand,
  stopLauncher
} from './modules/launcher'
import { executeVoiceCommand } from './modules/commands/execute'
import { registerVoiceHotkey } from './modules/voiceHotkey'

const WINDOW_WIDTH = 640
const WINDOW_HEIGHT = 300
const WINDOW_Y = 8

let mainWindow: BrowserWindow | null = null
let stopModules: (() => void) | undefined
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

const emitModuleEvent: ModuleEmitter = (event: IslandModuleEvent): void => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('island:module-event', event)
  }
}

function isActivityCommand(value: unknown): value is ActivityCommand {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  switch (value.type) {
    case 'timer.start':
      return (
        'minutes' in value &&
        typeof value.minutes === 'number' &&
        Number.isFinite(value.minutes) &&
        value.minutes > 0 &&
        value.minutes <= 24 * 60
      )
    case 'timer.pause':
    case 'timer.resume':
    case 'timer.cancel':
    case 'pomodoro.start':
    case 'pomodoro.pause':
    case 'pomodoro.skip':
    case 'pomodoro.reset':
      return true
    default:
      return false
  }
}

function getCentredX(): number {
  const primary = screen.getPrimaryDisplay()
  return Math.round(primary.workArea.x + (primary.workArea.width - WINDOW_WIDTH) / 2)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: getCentredX(),
    y: WINDOW_Y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // Keep on top at screen-saver level
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  // Click-through by default; renderer toggles on hover
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    stopModules = loadModules(emitModuleEvent)
    if (!hasSingleInstanceLock) return

    const hotkey = registerVoiceHotkey(
      (accelerator, callback) => globalShortcut.register(accelerator, callback),
      defaultConfig.voice.hotkey,
      () => emitModuleEvent({ type: 'voice.listen' })
    )
    if (!hotkey) {
      console.error(`[voice] Could not register configured or fallback hotkeys`)
      emitModuleEvent({
        type: 'ALERT',
        payload: {
          title: 'Voice hotkey unavailable',
          message: 'All voice shortcuts are in use. Wake-word activation is still available.',
          type: 'warning'
        }
      })
    } else if (hotkey !== defaultConfig.voice.hotkey) {
      console.warn(
        `[voice] Could not register ${defaultConfig.voice.hotkey}; using ${hotkey} instead`
      )
      emitModuleEvent({
        type: 'ALERT',
        payload: {
          title: 'Voice hotkey changed',
          message: `${defaultConfig.voice.hotkey} is unavailable. Use ${hotkey} instead.`,
          type: 'info'
        }
      })
    }
  })

  // Load renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function recentreWindow(): void {
  if (!mainWindow) return
  mainWindow.setPosition(getCentredX(), WINDOW_Y)
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return
  electronApp.setAppUserModelId('com.mino')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' && webContents === mainWindow?.webContents)
  })

  // Toggle click-through based on pill hover
  ipcMain.on('island:hover', (_event, hovering: boolean) => {
    if (!mainWindow) return
    if (hovering) {
      mainWindow.setFocusable(true)
      mainWindow.setIgnoreMouseEvents(false)
    } else {
      mainWindow.setFocusable(false)
      mainWindow.setIgnoreMouseEvents(true, { forward: true })
    }
  })

  ipcMain.handle('island:activity-command', (_event, command: unknown) => {
    if (!isActivityCommand(command)) {
      throw new TypeError('Invalid timer or Pomodoro command')
    }
    emitModuleEvent({ type: 'activity.command', payload: command })
  })

  // Media SMTC commands
  ipcMain.handle('island:media-command', (_event, cmd: unknown) => {
    const VALID: MediaCommand[] = ['play', 'pause', 'next', 'prev']
    if (typeof cmd !== 'string' || !VALID.includes(cmd as MediaCommand)) {
      throw new TypeError('Invalid media command')
    }
    const action =
      cmd === 'play'
        ? ('Play' as const)
        : cmd === 'pause'
          ? ('Pause' as const)
          : cmd === 'next'
            ? ('SkipNext' as const)
            : ('SkipPrevious' as const)
    return sendMediaCommand(action)
  })

  ipcMain.handle('island:launcher:run', (_event, input: unknown) => {
    if (typeof input !== 'string' || input.length > 512) {
      throw new TypeError('Invalid launcher command')
    }
    return runLauncherCommand(input, emitModuleEvent)
  })
  ipcMain.handle('island:voice:config', () => ({
    wakeWordEnabled: defaultConfig.voice.wakeWordEnabled
  }))
  ipcMain.handle('island:voice:run-command', (_event, input: unknown) => {
    if (typeof input !== 'string' || input.length > 512) {
      throw new TypeError('Invalid voice command')
    }
    return executeVoiceCommand(input, emitModuleEvent)
  })
  ipcMain.handle('island:launcher:refresh', () => refreshAppIndex())
  ipcMain.handle('island:voice:model-available', () => {
    const modelPath = app.isPackaged
      ? join(app.getAppPath(), 'out', 'renderer', 'vosk-model-small-en-in-0.4.tar.gz')
      : join(app.getAppPath(), 'assets', 'models', 'runtime', 'vosk-model-small-en-in-0.4.tar.gz')
    return existsSync(modelPath)
  })

  ipcMain.handle('island:pomodoro:config', () => defaultConfig.pomodoro)
  ipcMain.handle('island:pomodoro:stats:get', () => getTodayPomodoroStats())
  ipcMain.handle('island:pomodoro:stats:complete', async () => {
    const stats = await recordPomodoroRound()
    emitModuleEvent({ type: 'pomodoro.stats', payload: stats })
    return stats
  })

  void initializeLauncher(defaultConfig.launcher.aliases).catch((error: unknown) => {
    console.error('[launcher] Could not initialize app index', error)
  })
  createWindow()

  // Re-centre when display layout changes
  screen.on('display-metrics-changed', recentreWindow)
  screen.on('display-added', recentreWindow)
  screen.on('display-removed', recentreWindow)
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  stopModules?.()
  stopModules = undefined
  stopLauncher()
})

app.on('window-all-closed', () => {
  app.quit()
})
