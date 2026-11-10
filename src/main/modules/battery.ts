import * as systeminformation from 'systeminformation'
import type { Module } from './index'

const POLL_INTERVAL = 30_000
const LOW_BATTERY_THRESHOLD = 20

let interval: NodeJS.Timeout | undefined
let active = false
let pollInFlight = false
let previousACConnected: boolean | undefined
let lowBatteryAlerted = false

export const batteryModule: Module = {
  id: 'battery',
  priority: 10,

  start(emit) {
    if (active) return
    active = true
    void pollBattery(emit)
    interval = setInterval(() => void pollBattery(emit), POLL_INTERVAL)
  },

  stop() {
    active = false
    if (interval) clearInterval(interval)
    interval = undefined
    previousACConnected = undefined
    lowBatteryAlerted = false
  }
}

async function pollBattery(emit: Parameters<Module['start']>[0]): Promise<void> {
  if (!active || pollInFlight) return
  pollInFlight = true

  try {
    const battery = await systeminformation.battery()
    if (!active) return

    if (!battery.hasBattery) {
      previousACConnected = undefined
      lowBatteryAlerted = false
      emit({ type: 'battery.update', payload: { percent: null, charging: false } })
      return
    }

    const percent = Math.max(0, Math.min(100, Math.round(battery.percent)))
    emit({
      type: 'battery.update',
      payload: { percent, charging: battery.isCharging }
    })

    if (previousACConnected !== undefined && previousACConnected !== battery.acConnected) {
      emit({
        type: 'ALERT',
        payload: {
          title: battery.acConnected ? 'Power connected' : 'Power disconnected',
          message: battery.acConnected ? 'Battery is plugged in' : 'Running on battery',
          type: 'info'
        }
      })
    }
    previousACConnected = battery.acConnected

    if (percent <= LOW_BATTERY_THRESHOLD && !lowBatteryAlerted) {
      lowBatteryAlerted = true
      emit({
        type: 'ALERT',
        payload: {
          title: 'Battery low',
          message: `${percent}% remaining`,
          type: 'warning'
        }
      })
    } else if (percent > LOW_BATTERY_THRESHOLD) {
      lowBatteryAlerted = false
    }
  } catch (error) {
    console.error('[battery] Failed to read battery status', error)
  } finally {
    pollInFlight = false
  }
}
