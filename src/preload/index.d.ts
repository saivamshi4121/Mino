import type { IslandModuleEvent } from '../shared/moduleEvents'

declare global {
  interface Window {
    island: {
      setHover: (hovering: boolean) => void
      onModuleEvent: (callback: (event: IslandModuleEvent) => void) => () => void
    }
  }
}

export {}
