export interface AlertPayload {
  title: string
  message?: string
  type?: 'info' | 'warning' | 'success' | 'error'
}

export type IslandModuleEvent =
  | {
      type: 'battery.update'
      payload: {
        percent: number | null
        charging: boolean
      }
    }
  | {
      type: 'ALERT'
      payload: AlertPayload
    }
