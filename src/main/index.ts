import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

const WINDOW_WIDTH = 640
const WINDOW_HEIGHT = 300
const WINDOW_Y = 8

let mainWindow: BrowserWindow | null = null

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
  electronApp.setAppUserModelId('com.mino')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Toggle click-through based on pill hover
  ipcMain.on('island:hover', (_event, hovering: boolean) => {
    if (!mainWindow) return
    if (hovering) {
      mainWindow.setIgnoreMouseEvents(false)
    } else {
      mainWindow.setIgnoreMouseEvents(true, { forward: true })
    }
  })

  createWindow()

  // Re-centre when display layout changes
  screen.on('display-metrics-changed', recentreWindow)
  screen.on('display-added', recentreWindow)
  screen.on('display-removed', recentreWindow)
})

app.on('window-all-closed', () => {
  app.quit()
})
