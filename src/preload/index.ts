import { contextBridge, ipcRenderer } from 'electron'
import type { IslandModuleEvent } from '../shared/moduleEvents'

const island = {
  /** Tell main process whether the mouse is over the pill */
  setHover: (hovering: boolean): void => {
    ipcRenderer.send('island:hover', hovering)
  },
  onModuleEvent: (callback: (event: IslandModuleEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: IslandModuleEvent): void => {
      callback(data)
    }
    ipcRenderer.on('island:module-event', listener)
    return () => ipcRenderer.removeListener('island:module-event', listener)
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
