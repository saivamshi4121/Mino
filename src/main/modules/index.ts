import type { IslandModuleEvent } from '../../shared/moduleEvents'
import { batteryModule } from './battery'
import { mediaModule } from './media'

export type ModuleEmitter = (event: IslandModuleEvent) => void

export interface Module {
  id: string
  priority: number
  start: (emit: ModuleEmitter) => void
  stop: () => void
}

export function loadModules(emit: ModuleEmitter): () => void {
  const modules = [batteryModule, mediaModule].sort((a, b) => a.priority - b.priority)
  const started: Module[] = []

  for (const module of modules) {
    module.start(emit)
    started.push(module)
  }

  return () => {
    for (const module of started.reverse()) {
      module.stop()
    }
  }
}
