import type { DockSide } from './settings'
import type { PresenceLevel } from './settings'

export type PresenceEvent =
  | { type: 'shy'; active: boolean }
  | { type: 'summon' }
  | { type: 'foreground'; mode: 'normal' | 'browser' | 'hidden' }

export interface ScreenPoint {
  x: number
  y: number
}

export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

export interface DragPosition {
  screenX: number
  screenY: number
  offsetX: number
  offsetY: number
}

export interface PresenceApi {
  setLevel: (level: PresenceLevel) => void
  onEvent: (callback: (event: PresenceEvent) => void) => () => void
  drag: (phase: 'start' | 'move' | 'end', position?: DragPosition) => void
}

export function getDockOffset(dock: DockSide, hostWidth: number, pillWidth: number): number {
  if (dock === 'left') return 0
  if (dock === 'right') return hostWidth - pillWidth
  return (hostWidth - pillWidth) / 2
}

export function containsPoint(rect: ScreenRect, point: ScreenPoint): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

export function isNearRect(rect: ScreenRect, point: ScreenPoint, distance: number): boolean {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
  return dx <= distance && dy <= distance
}
