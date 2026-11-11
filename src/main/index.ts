import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  protocol,
  screen,
  session,
  Tray
} from 'electron'
import { execFile } from 'child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync
} from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { loadModules, type ModuleEmitter } from './modules'
import { sendMediaCommand } from './modules/media'
import type { IslandModuleEvent } from '../shared/moduleEvents'
import type { ActivityCommand, MediaCommand } from '../shared/moduleEvents'
import { getTodayPomodoroStats, recordPomodoroRound } from './modules/pomodoroStats'
import {
  initializeLauncher,
  refreshAppIndex,
  runLauncherCommand,
  stopLauncher
} from './modules/launcher'
import { executeVoiceCommand } from './modules/commands/execute'
import { registerVoiceHotkey } from './modules/voiceHotkey'
import { getSettings, loadSettings, saveSettings } from './config'
import type { MinoSettings, PresenceLevel } from '../shared/settings'
import {
  containsPoint,
  getDockOffset,
  isNearRect,
  type DragPosition,
  type PresenceEvent
} from '../shared/presence'

const WINDOW_WIDTH = 640
const WINDOW_HEIGHT = 300
const WINDOW_Y = 8
const SHY_DISTANCE = 24
const SHY_RETURN_DELAY = 400
const EDGE_DWELL_DELAY = 600
const VOSK_MODEL_FILE = 'vosk-model-small-en-in-0.4.tar.gz'
const MAX_LOG_BYTES = 2 * 1024 * 1024
const execFileAsync = promisify(execFile)
const FOREGROUND_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MinoWindow {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int index);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
}
'@
$window = [MinoWindow]::GetForegroundWindow()
$rect = New-Object MinoWindow+RECT
$monitorInfo = New-Object MinoWindow+MONITORINFO
$monitorInfo.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($monitorInfo)
$monitor = [MinoWindow]::MonitorFromWindow($window, 2)
$fullscreen = $false
if ([MinoWindow]::GetWindowRect($window, [ref]$rect) -and [MinoWindow]::GetMonitorInfo($monitor, [ref]$monitorInfo)) {
  $style = [MinoWindow]::GetWindowLongPtr($window, -16).ToInt64()
  $fullscreen = (($style -band 0x01000000) -eq 0) -and
    ([Math]::Abs($rect.Left - $monitorInfo.rcMonitor.Left) -le 2) -and
    ([Math]::Abs($rect.Top - $monitorInfo.rcMonitor.Top) -le 2) -and
    ([Math]::Abs($rect.Right - $monitorInfo.rcMonitor.Right) -le 2) -and
    ([Math]::Abs($rect.Bottom - $monitorInfo.rcMonitor.Bottom) -le 2)
}
$processId = [uint32]0
[void][MinoWindow]::GetWindowThreadProcessId($window, [ref]$processId)
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($process) { "$($process.ProcessName)|$fullscreen" }
`
const FOREGROUND_COMMAND = Buffer.from(FOREGROUND_SCRIPT, 'utf16le').toString('base64')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mino-model',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null
let stopModules: (() => void) | undefined
let cursorDisplayId: number | null = null
let cursorPollTimer: NodeJS.Timeout | undefined
let positionSaveTimer: NodeJS.Timeout | undefined
let foregroundTimer: NodeJS.Timeout | undefined
let presenceLevel: PresenceLevel = 'ghost'
let foregroundMode: 'normal' | 'browser' | 'hidden' = 'normal'
let shyActive = false
let shyExitAt: number | null = null
let edgeDwellStartedAt: number | null = null
let edgeDwellTriggered = false
let foregroundPollInFlight = false
let dragActive = false
let windowInteractive = false
const hasSingleInstanceLock = app.requestSingleInstanceLock()

app.setPath('userData', join(app.getPath('appData'), 'dynamic-island'))

const crashLogPath = join(app.getPath('userData'), 'logs', 'mino.log')

function logCrash(message: string, error?: unknown): void {
  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : String(error ?? '')
  const entry = `[${new Date().toISOString()}] ${message}${detail ? `\n${detail}` : ''}\n`
  try {
    const directory = join(app.getPath('userData'), 'logs')
    mkdirSync(directory, { recursive: true })
    if (existsSync(crashLogPath) && statSync(crashLogPath).size >= MAX_LOG_BYTES) {
      const previousLogPath = `${crashLogPath}.1`
      if (existsSync(previousLogPath)) unlinkSync(previousLogPath)
      renameSync(crashLogPath, previousLogPath)
    }
    appendFileSync(crashLogPath, entry, 'utf8')
  } catch (logError) {
    console.error('[crash-log] Could not write crash log', logError, entry)
  }
}

process.on('uncaughtExceptionMonitor', (error, origin) => {
  logCrash(`Uncaught exception (${origin})`, error)
})
process.on('unhandledRejection', (reason) => {
  logCrash('Unhandled promise rejection', reason)
  throw reason
})

function getVoskModelPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'models', VOSK_MODEL_FILE)
    : join(app.getAppPath(), 'assets', 'models', 'runtime', VOSK_MODEL_FILE)
}

async function registerVoskModelProtocol(): Promise<void> {
  await protocol.handle('mino-model', async (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'model' || url.pathname !== `/${VOSK_MODEL_FILE}`) {
      return new Response('Not found', { status: 404 })
    }

    try {
      const model = readFileSync(getVoskModelPath())
      return new Response(model, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/gzip'
        }
      })
    } catch (error) {
      logCrash('Could not serve the bundled Vosk model', error)
      return new Response('Vosk model unavailable', { status: 500 })
    }
  })
}

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

function getTargetDisplay(): Electron.Display {
  const config = getSettings().display
  if (config.mode === 'cursor') {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  }
  if (config.mode === 'chosen') {
    const selected = screen.getAllDisplays().find((display) => display.id === config.displayId)
    if (selected) return selected
  }
  return screen.getPrimaryDisplay()
}

function getWindowPosition(): { x: number; y: number } {
  const { workArea } = getTargetDisplay()
  const saved = getSettings().appearance.position
  const requestedX = saved.x ?? workArea.x + Math.round((workArea.width - WINDOW_WIDTH) / 2)
  const requestedY = saved.y ?? workArea.y + WINDOW_Y
  return {
    x: Math.max(workArea.x, Math.min(requestedX, workArea.x + workArea.width - WINDOW_WIDTH)),
    y: Math.max(workArea.y, Math.min(requestedY, workArea.y + workArea.height - WINDOW_HEIGHT))
  }
}

function setIslandInteractive(interactive: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const allowed =
    interactive &&
    presenceLevel !== 'ghost' &&
    !shyActive &&
    foregroundMode !== 'hidden' &&
    !(foregroundMode === 'browser' && presenceLevel !== 'summon')
  if (allowed === windowInteractive) return
  windowInteractive = allowed
  mainWindow.setFocusable(allowed)
  mainWindow.setIgnoreMouseEvents(!allowed, { forward: true })
}

function emitPresenceEvent(event: PresenceEvent): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('island:presence-event', event)
  }
}

function setShy(active: boolean): void {
  if (shyActive === active) return
  shyActive = active
  emitPresenceEvent({ type: 'shy', active })
  if (active) setIslandInteractive(false)
}

function setPresenceLevel(level: PresenceLevel): void {
  if (presenceLevel === level) return
  presenceLevel = level
  shyExitAt = null
  edgeDwellStartedAt = null
  edgeDwellTriggered = false
  if (level === 'summon') {
    setShy(false)
    if (cursorPollTimer) clearTimeout(cursorPollTimer)
    cursorPollTimer = undefined
  } else {
    setIslandInteractive(false)
    scheduleCursorPoll()
  }
}

function persistIslandPosition(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const [x, y] = mainWindow.getPosition()
  try {
    saveSettings({
      ...getSettings(),
      appearance: { ...getSettings().appearance, position: { x, y } }
    })
  } catch (error) {
    console.error('[settings] Could not persist island position', error)
  }
}

function schedulePositionSave(): void {
  if (positionSaveTimer) clearTimeout(positionSaveTimer)
  positionSaveTimer = setTimeout(() => {
    positionSaveTimer = undefined
    persistIslandPosition()
  }, 350)
}

function setForegroundMode(mode: 'normal' | 'browser' | 'hidden'): void {
  const changed = foregroundMode !== mode
  if (changed) {
    foregroundMode = mode
    emitPresenceEvent({ type: 'foreground', mode })
  }
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setOpacity(mode === 'hidden' ? 0 : 1)
  if (mode === 'hidden') setIslandInteractive(false)
  else if (changed) scheduleCursorPoll()
}

function getPillRect(): { x: number; y: number; width: number; height: number } {
  if (!mainWindow) return { x: 0, y: 0, width: 0, height: 0 }
  const [windowX, windowY] = mainWindow.getPosition()
  let width = presenceLevel === 'ghost' ? 140 : 220
  let height = presenceLevel === 'ghost' ? 2 : 38
  if (foregroundMode === 'browser' && getSettings().appearance.browserDot) {
    width = 12
    height = 12
  }
  const dock =
    presenceLevel === 'glance' && foregroundMode !== 'browser'
      ? getSettings().appearance.dock
      : 'center'
  return {
    x: windowX + getDockOffset(dock, WINDOW_WIDTH, width),
    y: windowY,
    width,
    height
  }
}

function pollCursor(): void {
  cursorPollTimer = undefined
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    presenceLevel === 'summon' ||
    foregroundMode === 'hidden'
  ) {
    return
  }
  if (dragActive) {
    scheduleCursorPoll()
    return
  }
  const point = screen.getCursorScreenPoint()
  let display = getTargetDisplay()
  if (getSettings().display.mode === 'cursor' && display.id !== cursorDisplayId) {
    recentreWindow()
    display = getTargetDisplay()
  }
  const edgeCenter = display.bounds.x + display.bounds.width / 2
  const onSummonEdge = Math.abs(point.x - edgeCenter) <= 80 && point.y <= display.bounds.y + 4
  const now = Date.now()
  if (onSummonEdge) {
    if (edgeDwellStartedAt === null) edgeDwellStartedAt = now
    if (!edgeDwellTriggered && now - edgeDwellStartedAt >= EDGE_DWELL_DELAY) {
      edgeDwellTriggered = true
      emitPresenceEvent({ type: 'summon' })
    }
  } else {
    edgeDwellStartedAt = null
    edgeDwellTriggered = false
  }

  const pillRect = getPillRect()
  const inside = containsPoint(pillRect, point)
  const near = isNearRect(pillRect, point, SHY_DISTANCE)
  if (inside) {
    shyExitAt = null
    setShy(false)
    setIslandInteractive(presenceLevel === 'glance')
  } else {
    setIslandInteractive(false)
    if (near) {
      shyExitAt = null
      setShy(true)
    } else if (shyActive) {
      if (shyExitAt === null) shyExitAt = now
      if (now - shyExitAt >= SHY_RETURN_DELAY) {
        shyExitAt = null
        setShy(false)
      }
    }
  }
  scheduleCursorPoll()
}

function scheduleCursorPoll(): void {
  if (cursorPollTimer || !mainWindow || mainWindow.isDestroyed() || presenceLevel === 'summon') {
    return
  }
  cursorPollTimer = setTimeout(pollCursor, 60)
}

let foregroundProcessName = ''
let foregroundFullscreen = false

async function pollForeground(): Promise<void> {
  if (foregroundPollInFlight || !mainWindow || mainWindow.isDestroyed()) return
  foregroundPollInFlight = true
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', FOREGROUND_COMMAND],
      { timeout: 2500, windowsHide: true }
    )
    const [processName = '', fullscreen = 'False'] = stdout.trim().split('|')
    foregroundProcessName = processName.toLowerCase()
    foregroundFullscreen = fullscreen.trim().toLowerCase() === 'true'
    updateForegroundMode()
  } catch (error) {
    console.error('[presence] Could not detect foreground application', error)
  } finally {
    foregroundPollInFlight = false
  }
}

function updateForegroundMode(): void {
  const appearance = getSettings().appearance
  const mode =
    appearance.hideFullscreen && foregroundFullscreen
      ? 'hidden'
      : appearance.browserDot && /^(chrome|msedge|firefox)$/.test(foregroundProcessName)
        ? 'browser'
        : 'normal'
  setForegroundMode(mode)
}

function recentreWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const { id } = getTargetDisplay()
  cursorDisplayId = id
  const { x, y } = getWindowPosition()
  if (mainWindow.getPosition()[0] !== x || mainWindow.getPosition()[1] !== y) {
    mainWindow.setPosition(x, y)
  }
}

function createWindow(): void {
  const { x, y } = getWindowPosition()
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
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
  mainWindow.on('show', updateTrayMenu)
  mainWindow.on('hide', updateTrayMenu)
  mainWindow.on('move', schedulePositionSave)
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logCrash(`Renderer process exited (${details.reason}, code ${details.exitCode})`)
  })

  // Keep on top at screen-saver level
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  // Click-through by default; renderer toggles on hover
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    stopModules = loadModules(emitModuleEvent)
    scheduleCursorPoll()
    void pollForeground()
    if (!hasSingleInstanceLock) return

    const hotkey = registerVoiceHotkey(
      (accelerator, callback) => globalShortcut.register(accelerator, callback),
      getSettings().voice.hotkey,
      () => emitModuleEvent({ type: 'voice.listen' })
    )
    if (!hotkey) {
      console.error('[voice] Could not register configured or fallback hotkeys')
      emitModuleEvent({
        type: 'ALERT',
        payload: {
          title: 'Voice hotkey unavailable',
          message: 'All voice shortcuts are in use. Wake-word activation is still available.',
          type: 'warning'
        }
      })
    } else if (hotkey !== getSettings().voice.hotkey) {
      console.warn(
        `[voice] Could not register ${getSettings().voice.hotkey}; using ${hotkey} instead`
      )
      emitModuleEvent({
        type: 'ALERT',
        payload: {
          title: 'Voice hotkey changed',
          message: `${getSettings().voice.hotkey} is unavailable. Use ${hotkey} instead.`,
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
  recentreWindow()
}

function updateTrayMenu(): void {
  if (!tray) return
  const settings = getSettings()
  const visible = Boolean(
    mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && foregroundMode !== 'hidden'
  )
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: visible ? 'Hide island' : 'Show island',
        click: () => {
          if (!mainWindow || mainWindow.isDestroyed()) return
          if (mainWindow.isVisible()) mainWindow.hide()
          else mainWindow.show()
          updateTrayMenu()
        }
      },
      {
        label: 'Wake word',
        type: 'checkbox',
        checked: settings.voice.wakeWordEnabled,
        click: (item) => {
          void applySettings({
            ...getSettings(),
            voice: { ...getSettings().voice, wakeWordEnabled: item.checked }
          }).catch((error: unknown) =>
            console.error('[settings] Could not toggle wake word', error)
          )
        }
      },
      {
        label: 'Microphone',
        type: 'checkbox',
        checked: settings.voice.microphoneEnabled,
        click: (item) => {
          void applySettings({
            ...getSettings(),
            voice: { ...getSettings().voice, microphoneEnabled: item.checked }
          }).catch((error: unknown) =>
            console.error('[settings] Could not toggle microphone', error)
          )
        }
      },
      { type: 'separator' },
      { label: 'Settings', click: openSettingsWindow },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked })
          updateTrayMenu()
        }
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
}

function createTray(): void {
  const iconPath = join(app.getAppPath(), 'resources', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    console.error(`[tray] Could not load tray icon at ${iconPath}`)
    return
  }
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Mino')
  updateTrayMenu()
}

function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 560,
    height: 680,
    minWidth: 480,
    minHeight: 560,
    title: 'Mino Settings',
    frame: false,
    transparent: true,
    resizable: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  settingsWindow.on('ready-to-show', () => settingsWindow?.show())
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?window=settings`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'settings' }
    })
  }
}

async function applySettings(value: unknown): Promise<MinoSettings> {
  const previous = getSettings()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Settings must be a JSON object')
  }
  const input = value as Record<string, unknown>
  const appearance =
    typeof input.appearance === 'object' &&
    input.appearance !== null &&
    !Array.isArray(input.appearance)
      ? (input.appearance as Record<string, unknown>)
      : {}
  const next = saveSettings({
    ...input,
    appearance: { ...appearance, position: previous.appearance.position }
  })
  if (previous.voice.hotkey !== next.voice.hotkey) {
    globalShortcut.unregisterAll()
    const registered = registerVoiceHotkey(
      (accelerator, callback) => globalShortcut.register(accelerator, callback),
      next.voice.hotkey,
      () => emitModuleEvent({ type: 'voice.listen' })
    )
    if (!registered) {
      console.error('[voice] Could not register configured or fallback hotkeys')
      emitModuleEvent({
        type: 'ALERT',
        payload: {
          title: 'Voice hotkey unavailable',
          message: 'The configured shortcut and all fallback shortcuts are already in use.',
          type: 'warning'
        }
      })
    } else if (registered !== next.voice.hotkey) {
      emitModuleEvent({
        type: 'ALERT',
        payload: {
          title: 'Voice hotkey changed',
          message: `${next.voice.hotkey} is unavailable. Use ${registered} instead.`,
          type: 'info'
        }
      })
    }
  }
  updateForegroundMode()
  if (JSON.stringify(previous.launcher.aliases) !== JSON.stringify(next.launcher.aliases)) {
    await initializeLauncher(next.launcher.aliases)
  }
  recentreWindow()
  emitModuleEvent({ type: 'settings.updated', payload: next })
  updateTrayMenu()
  return next
}

app
  .whenReady()
  .then(async () => {
    await registerVoskModelProtocol()
    if (!hasSingleInstanceLock) return
    electronApp.setAppUserModelId('com.mino')
    loadSettings()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(permission === 'media' && webContents === mainWindow?.webContents)
    })

    // Toggle click-through based on pill hover
    ipcMain.on('island:hover', (_event, hovering: boolean) => {
      if (typeof hovering !== 'boolean') return
      if (foregroundMode === 'hidden' || shyActive) return
      if (presenceLevel === 'ghost') {
        setIslandInteractive(false)
        return
      }
      if (foregroundMode === 'browser' && presenceLevel !== 'summon') {
        setIslandInteractive(false)
        return
      }
      setIslandInteractive(hovering)
    })
    ipcMain.on('island:presence-level', (event, level: unknown) => {
      if (event.sender !== mainWindow?.webContents) return
      if (level !== 'ghost' && level !== 'glance' && level !== 'summon') {
        console.error('[presence] Ignoring invalid presence level')
        return
      }
      setPresenceLevel(level)
      emitPresenceEvent({ type: 'foreground', mode: foregroundMode })
      emitPresenceEvent({ type: 'shy', active: shyActive })
    })
    ipcMain.on('island:drag', (event, phase: unknown, position?: unknown) => {
      if (event.sender !== mainWindow?.webContents || !mainWindow) return
      if (phase === 'start') {
        if (presenceLevel !== 'glance' || foregroundMode !== 'normal' || shyActive) return
        dragActive = true
        setIslandInteractive(true)
        return
      }
      if (phase === 'move') {
        const dragPosition = position as DragPosition | undefined
        if (
          !dragActive ||
          !dragPosition ||
          typeof dragPosition !== 'object' ||
          ![
            dragPosition.screenX,
            dragPosition.screenY,
            dragPosition.offsetX,
            dragPosition.offsetY
          ].every(Number.isFinite)
        ) {
          return
        }
        const { workArea } = getTargetDisplay()
        const dockOffset = getDockOffset(getSettings().appearance.dock, WINDOW_WIDTH, 220)
        const x = Math.max(
          workArea.x,
          Math.min(
            Math.round(dragPosition.screenX - dragPosition.offsetX - dockOffset),
            workArea.x + workArea.width - WINDOW_WIDTH
          )
        )
        const y = Math.max(
          workArea.y,
          Math.min(
            Math.round(dragPosition.screenY - dragPosition.offsetY),
            workArea.y + workArea.height - WINDOW_HEIGHT
          )
        )
        mainWindow.setPosition(x, y)
        return
      }
      if (phase === 'end') {
        dragActive = false
        persistIslandPosition()
        scheduleCursorPoll()
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
      wakeWordEnabled: getSettings().voice.wakeWordEnabled,
      microphoneEnabled: getSettings().voice.microphoneEnabled
    }))
    ipcMain.handle('island:voice:run-command', (_event, input: unknown) => {
      if (typeof input !== 'string' || input.length > 512) {
        throw new TypeError('Invalid voice command')
      }
      return executeVoiceCommand(input, emitModuleEvent)
    })
    ipcMain.handle('island:launcher:refresh', () => refreshAppIndex())
    ipcMain.handle('island:voice:model-available', () => {
      return existsSync(getVoskModelPath())
    })
    ipcMain.handle('island:voice:model-url', () =>
      app.isPackaged ? `mino-model://model/${VOSK_MODEL_FILE}` : VOSK_MODEL_FILE
    )

    ipcMain.handle('island:pomodoro:config', () => getSettings().pomodoro)
    ipcMain.handle('island:pomodoro:stats:get', () => getTodayPomodoroStats())
    ipcMain.handle('island:pomodoro:stats:complete', async () => {
      const stats = await recordPomodoroRound()
      emitModuleEvent({ type: 'pomodoro.stats', payload: stats })
      return stats
    })

    ipcMain.handle('island:settings:get', () => getSettings())
    ipcMain.handle('island:settings:displays', () =>
      screen.getAllDisplays().map((display, index) => ({
        id: display.id,
        label: `Display ${index + 1} (${display.bounds.width} x ${display.bounds.height})`,
        bounds: display.bounds
      }))
    )
    ipcMain.handle('island:settings:save', (_event, input: unknown) => applySettings(input))
    ipcMain.handle('island:settings:onboarding-complete', async () =>
      applySettings({ ...getSettings(), onboardingComplete: true })
    )
    ipcMain.handle('island:settings:startup', (_event, enabled: unknown) => {
      if (typeof enabled !== 'boolean') throw new TypeError('Startup setting must be a boolean')
      app.setLoginItemSettings({ openAtLogin: enabled })
      return app.getLoginItemSettings().openAtLogin
    })
    ipcMain.handle('island:settings:startup:get', () => app.getLoginItemSettings().openAtLogin)
    ipcMain.handle('island:settings:open', () => openSettingsWindow())

    void initializeLauncher(getSettings().launcher.aliases).catch((error: unknown) => {
      console.error('[launcher] Could not initialize app index', error)
    })
    foregroundTimer = setInterval(() => void pollForeground(), 1200)
    createTray()
    createWindow()

    // Re-centre when display layout changes
    screen.on('display-metrics-changed', recentreWindow)
    screen.on('display-added', recentreWindow)
    screen.on('display-removed', recentreWindow)
  })
  .catch((error: unknown) => {
    logCrash('Application startup failed', error)
    app.quit()
  })

app.on('child-process-gone', (_event, details) => {
  logCrash(`Child process exited (${details.type}: ${details.reason}, code ${details.exitCode})`)
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  if (cursorPollTimer) clearTimeout(cursorPollTimer)
  cursorPollTimer = undefined
  if (positionSaveTimer) clearTimeout(positionSaveTimer)
  positionSaveTimer = undefined
  if (foregroundTimer) clearInterval(foregroundTimer)
  foregroundTimer = undefined
  stopModules?.()
  stopModules = undefined
  stopLauncher()
})

app.on('window-all-closed', () => {
  app.quit()
})
