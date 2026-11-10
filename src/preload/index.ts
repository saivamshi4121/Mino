import { contextBridge, ipcRenderer } from 'electron'

const island = {
  /** Tell main process whether the mouse is over the pill */
  setHover: (hovering: boolean): void => {
    ipcRenderer.send('island:hover', hovering)
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
