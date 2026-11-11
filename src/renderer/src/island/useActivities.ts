import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ActivityCommand,
  IslandModuleEvent,
  PomodoroConfig,
  PomodoroStats
} from '../../../shared/moduleEvents'
import type { IslandEvent } from './islandMachine'
import { getNextPomodoroPhase, type PomodoroPhase } from './pomodoroLogic'
import chimeUrl from '../../../../assets/sounds/chime.wav'

export interface ActiveActivity {
  mode: 'timer' | 'pomodoro'
  running: boolean
  remainingMs: number
  durationMs: number
  endsAt: number | null
  phase: PomodoroPhase | null
  cycleRound: number
}

const DEFAULT_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  roundsUntilLongBreak: 4
}

const MINUTE = 60_000

function getPhaseDuration(phase: PomodoroPhase, config: PomodoroConfig): number {
  const minutes =
    phase === 'focus'
      ? config.focusMinutes
      : phase === 'break'
        ? config.breakMinutes
        : config.longBreakMinutes
  return minutes * MINUTE
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useActivities(send: (event: IslandEvent) => void): {
  activity: ActiveActivity | null
  config: PomodoroConfig
  stats: PomodoroStats | null
  handleModuleEvent: (event: IslandModuleEvent) => void
  sendCommand: (command: ActivityCommand) => void
} {
  const [activity, setActivity] = useState<ActiveActivity | null>(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [stats, setStats] = useState<PomodoroStats | null>(null)
  const activityRef = useRef<ActiveActivity | null>(null)
  const configRef = useRef(config)
  const tickerRef = useRef<number | null>(null)
  const finishRef = useRef<(() => void) | null>(null)

  const updateActivity = useCallback((next: ActiveActivity | null): void => {
    activityRef.current = next
    setActivity(next)
  }, [])

  const stopTicker = useCallback((): void => {
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current)
      tickerRef.current = null
    }
  }, [])

  const reportError = useCallback(
    (title: string, error: unknown): void => {
      console.error(`[activity] ${title}`, error)
      send({
        type: 'ALERT',
        payload: { title, message: getErrorMessage(error), type: 'error' }
      })
    },
    [send]
  )

  const runTicker = useCallback((): void => {
    stopTicker()
    tickerRef.current = window.setInterval(() => {
      const current = activityRef.current
      if (!current?.running || current.endsAt === null) return
      const remainingMs = Math.max(0, current.endsAt - Date.now())
      if (remainingMs === 0) {
        stopTicker()
        finishRef.current?.()
      } else {
        updateActivity({ ...current, remainingMs })
      }
    }, 1000)
  }, [stopTicker, updateActivity])

  const startPhase = useCallback(
    (phase: PomodoroPhase, cycleRound: number): void => {
      const durationMs = getPhaseDuration(phase, configRef.current)
      updateActivity({
        mode: 'pomodoro',
        running: true,
        remainingMs: durationMs,
        durationMs,
        endsAt: Date.now() + durationMs,
        phase,
        cycleRound
      })
      send({ type: 'ACTIVITY_START' })
      runTicker()
    },
    [runTicker, send, updateActivity]
  )

  const startTimer = useCallback(
    (minutes: number): void => {
      const durationMs = minutes * MINUTE
      updateActivity({
        mode: 'timer',
        running: true,
        remainingMs: durationMs,
        durationMs,
        endsAt: Date.now() + durationMs,
        phase: null,
        cycleRound: 0
      })
      send({ type: 'ACTIVITY_START' })
      runTicker()
    },
    [runTicker, send, updateActivity]
  )

  const completeActivity = useCallback(async (): Promise<void> => {
    const current = activityRef.current
    if (!current?.running) return

    stopTicker()
    const pending = { ...current, running: false, remainingMs: 0, endsAt: null }
    updateActivity(pending)

    if (current.mode === 'timer') {
      updateActivity(null)
      send({ type: 'ACTIVITY_STOP' })
      send({
        type: 'ALERT',
        payload: { title: "Time's up", message: 'Your countdown is complete', type: 'success' }
      })
      const audio = new Audio(chimeUrl)
      void audio.play().catch((error: unknown) => reportError('Could not play timer chime', error))
      return
    }

    let saveError: unknown
    if (current.phase === 'focus') {
      try {
        const updatedStats = await window.island.recordPomodoroRound()
        setStats(updatedStats)
      } catch (error) {
        saveError = error
        console.error('[activity] Could not save completed Pomodoro round', error)
      }
    }

    if (activityRef.current !== pending || current.phase === null) return

    const transition = getNextPomodoroPhase(
      current.phase,
      current.cycleRound,
      configRef.current.roundsUntilLongBreak
    )
    startPhase(transition.phase, transition.cycleRound)

    send({
      type: 'ALERT',
      payload: {
        title:
          transition.phase === 'focus'
            ? 'Focus time'
            : transition.phase === 'longBreak'
              ? 'Long break'
              : 'Break time',
        message: [
          transition.phase === 'focus'
            ? 'Your break is over'
            : transition.phase === 'longBreak'
              ? 'Great work! Take a longer break'
              : 'Focus session complete',
          ...(saveError
            ? [`Today's round count could not be saved: ${getErrorMessage(saveError)}`]
            : [])
        ].join(' '),
        type: saveError ? 'error' : 'info'
      }
    })
  }, [reportError, send, startPhase, stopTicker, updateActivity])

  useEffect(() => {
    finishRef.current = () => {
      void completeActivity()
    }
    return () => {
      finishRef.current = null
    }
  }, [completeActivity])

  const pauseActivity = useCallback((): void => {
    const current = activityRef.current
    if (!current?.running || current.endsAt === null) return
    stopTicker()
    updateActivity({
      ...current,
      running: false,
      remainingMs: Math.max(0, current.endsAt - Date.now()),
      endsAt: null
    })
  }, [stopTicker, updateActivity])

  const resumeActivity = useCallback((): void => {
    const current = activityRef.current
    if (!current || current.running || current.remainingMs <= 0) return
    const resumed = {
      ...current,
      running: true,
      endsAt: Date.now() + current.remainingMs
    }
    updateActivity(resumed)
    runTicker()
  }, [runTicker, updateActivity])

  const cancelActivity = useCallback((): void => {
    stopTicker()
    updateActivity(null)
    send({ type: 'ACTIVITY_STOP' })
  }, [send, stopTicker, updateActivity])

  const skipPomodoroPhase = useCallback((): void => {
    const current = activityRef.current
    if (!current || current.mode !== 'pomodoro' || current.phase === null) return
    stopTicker()
    const transition = getNextPomodoroPhase(
      current.phase,
      current.cycleRound,
      configRef.current.roundsUntilLongBreak,
      false
    )
    startPhase(transition.phase, transition.cycleRound)
    send({
      type: 'ALERT',
      payload: {
        title: transition.phase === 'focus' ? 'Focus time' : 'Break time',
        message: 'Pomodoro phase skipped',
        type: 'info'
      }
    })
  }, [send, startPhase, stopTicker])

  const handleCommand = useCallback(
    (command: ActivityCommand): void => {
      switch (command.type) {
        case 'timer.start':
          startTimer(command.minutes)
          break
        case 'timer.resume':
          if (activityRef.current?.mode === 'timer') resumeActivity()
          break
        case 'timer.pause':
          if (activityRef.current?.mode === 'timer') pauseActivity()
          break
        case 'timer.cancel':
          if (activityRef.current?.mode === 'timer') cancelActivity()
          break
        case 'pomodoro.start':
          if (activityRef.current?.mode === 'pomodoro') resumeActivity()
          else startPhase('focus', 0)
          break
        case 'pomodoro.pause':
          if (activityRef.current?.mode === 'pomodoro') pauseActivity()
          break
        case 'pomodoro.skip':
          skipPomodoroPhase()
          break
        case 'pomodoro.reset':
          if (activityRef.current?.mode === 'pomodoro') cancelActivity()
          break
      }
    },
    [cancelActivity, pauseActivity, resumeActivity, skipPomodoroPhase, startPhase, startTimer]
  )

  const handleModuleEvent = useCallback(
    (event: IslandModuleEvent): void => {
      if (event.type === 'activity.command') {
        handleCommand(event.payload)
      } else if (event.type === 'pomodoro.stats') {
        setStats(event.payload)
      }
    },
    [handleCommand]
  )

  const sendCommand = useCallback(
    (command: ActivityCommand): void => {
      const request =
        command.type === 'timer.start'
          ? window.island.timer.start(command.minutes)
          : command.type === 'timer.resume'
            ? window.island.timer.resume()
            : command.type === 'timer.pause'
              ? window.island.timer.pause()
              : command.type === 'timer.cancel'
                ? window.island.timer.cancel()
                : command.type === 'pomodoro.start'
                  ? window.island.pomodoro.start()
                  : command.type === 'pomodoro.pause'
                    ? window.island.pomodoro.pause()
                    : command.type === 'pomodoro.skip'
                      ? window.island.pomodoro.skip()
                      : window.island.pomodoro.reset()
      void request.catch((error: unknown) => {
        reportError('Could not run timer or Pomodoro command', error)
      })
    },
    [reportError]
  )

  useEffect(() => {
    let active = true
    void Promise.all([window.island.getPomodoroConfig(), window.island.getPomodoroStats()])
      .then(([loadedConfig, loadedStats]) => {
        if (!active) return
        configRef.current = loadedConfig
        setConfig(loadedConfig)
        setStats(loadedStats)
      })
      .catch((error: unknown) => reportError('Could not load Pomodoro settings or stats', error))

    return () => {
      active = false
      stopTicker()
    }
  }, [reportError, stopTicker])

  useEffect(() => {
    return window.island.onModuleEvent((event) => {
      if (event.type !== 'settings.updated') return
      configRef.current = event.payload.pomodoro
      setConfig(event.payload.pomodoro)
    })
  }, [])

  return { activity, config, stats, handleModuleEvent, sendCommand }
}
