import { useState, useCallback, useEffect, useRef, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMachine } from '@xstate/react'
import { islandMachine, ISLAND_SIZES, type IslandState, type IslandEvent } from './islandMachine'
import type {
  IslandModuleEvent,
  LauncherStatus,
  MediaInfo,
  MediaCommand
} from '../../../shared/moduleEvents'
import BatteryWidget from '../widgets/BatteryWidget'
import ClockWidget from '../widgets/ClockWidget'
import ActivityWidgets, { ActivityCompactWidget } from '../widgets/ActivityWidgets'
import { MediaCompactWidget, MediaExpandedWidget } from '../widgets/MediaWidget'
import { useActivities } from './useActivities'
import { useVoice } from './useVoice'

/** Spring config matching the spec: stiffness 300, damping 25 */
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 25 }

/** Glow colours per state */
const GLOW_COLORS: Record<IslandState, string> = {
  idle: 'rgba(255,255,255,0.0)',
  compact: 'rgba(255,255,255,0.08)',
  listening: 'rgba(56,189,248,0.35)',
  expanded: 'rgba(255,255,255,0.12)',
  alert: 'rgba(251,146,60,0.4)'
}

export default function Island(): React.JSX.Element {
  const [snapshot, send] = useMachine(islandMachine)
  const state = snapshot.value as IslandState
  const [devPanelVisible, setDevPanelVisible] = useState(false)
  const size = ISLAND_SIZES[state]
  const [contentReadyState, setContentReadyState] = useState<IslandState | null>(null)
  const contentVisible = contentReadyState === state
  const activities = useActivities(send)
  const voice = useVoice(send)
  const { handleModuleEvent: handleActivityModuleEvent } = activities

  useEffect(() => {
    window.island.setHover(devPanelVisible)
  }, [devPanelVisible])

  // Media state — null when nothing is playing
  const [media, setMedia] = useState<MediaInfo | null>(null)
  const [launcherStatus, setLauncherStatus] = useState<LauncherStatus | null>(null)
  const launcherStatusTimer = useRef<number | null>(null)

  // Priority: activity > media > idle
  const hasActivity = !!activities.activity
  const hasMedia = !!media
  const hasActivityRef = useRef(hasActivity)
  const hasMediaRef = useRef(hasMedia)

  useEffect(() => {
    hasActivityRef.current = hasActivity
    hasMediaRef.current = hasMedia
  }, [hasActivity, hasMedia])

  const glowColor =
    state === 'compact' && activities.activity?.mode === 'pomodoro'
      ? activities.activity.phase === 'focus'
        ? 'rgba(248,113,113,0.3)'
        : 'rgba(74,222,128,0.28)'
      : state === 'compact' && hasMedia && !hasActivity
        ? 'rgba(167,139,250,0.28)' // purple-ish for media
        : GLOW_COLORS[state]

  const [battery, setBattery] = useState<{ percent: number | null; charging: boolean }>({
    percent: null,
    charging: false
  })

  useEffect(() => {
    const handleModuleEvent = (event: IslandModuleEvent): void => {
      if (event.type === 'battery.update') {
        setBattery(event.payload)
      } else if (event.type === 'media.update') {
        const { title, artist, status } = event.payload
        // Only show if something is actively playing or paused
        if (status === 'Playing' || status === 'Paused') {
          setMedia({ title, artist, status })
          // Show compact pill when media starts playing and no activity is running
          if (!hasActivity) {
            send({ type: 'ACTIVITY_START' })
          }
        } else {
          setMedia(null)
          if (!hasActivity) {
            send({ type: 'ACTIVITY_STOP' })
          }
        }
      } else if (event.type === 'ALERT') {
        send({ type: 'ALERT', payload: event.payload })
      } else if (event.type === 'launcher.status') {
        const status = event.payload
        setLauncherStatus(status)
        if (launcherStatusTimer.current !== null) {
          window.clearTimeout(launcherStatusTimer.current)
          launcherStatusTimer.current = null
        }
        if (status.phase === 'opening' || status.phase === 'closing') {
          send({ type: 'ACTIVITY_START' })
        }
        if (status.phase === 'opened' || status.phase === 'closed' || status.phase === 'failed') {
          if (status.phase === 'failed') {
            send({
              type: 'ALERT',
              payload: {
                title: status.message?.startsWith("Couldn't find")
                  ? "Couldn't find app"
                  : 'App launch failed',
                message: status.message,
                type: 'error'
              }
            })
          }
          launcherStatusTimer.current = window.setTimeout(
            () => {
              setLauncherStatus(null)
              launcherStatusTimer.current = null
              if (!hasActivityRef.current && !hasMediaRef.current) {
                send({ type: 'ACTIVITY_STOP' })
              }
            },
            status.phase === 'failed' ? 4200 : 1400
          )
        }
      } else {
        handleActivityModuleEvent(event)
      }
    }
    return window.island.onModuleEvent(handleModuleEvent)
  }, [handleActivityModuleEvent, hasActivity, media, send])

  useEffect(
    () => () => {
      if (launcherStatusTimer.current !== null) window.clearTimeout(launcherStatusTimer.current)
    },
    []
  )

  const handleMouseEnter = useCallback((): void => {
    window.island.setHover(true)
    if (state === 'idle') send({ type: 'HOVER' })
  }, [state, send])

  const handleMouseLeave = useCallback((): void => {
    if (!devPanelVisible) {
      window.island.setHover(false)
      if (state === 'compact' && !activities.activity && !media) send({ type: 'OUTSIDE' })
    }
  }, [activities.activity, devPanelVisible, media, state, send])

  // Any pointer/key activity inside the expanded pill resets its auto-close timer
  const handleExpandedActivity = useCallback((): void => {
    if (state === 'expanded') send({ type: 'KEEP_OPEN' })
  }, [state, send])

  const handleExpandedContentClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      event.stopPropagation()
    },
    []
  )

  const handleClick = useCallback((): void => {
    if (state === 'alert') {
      send({ type: 'DISMISS' })
    } else if (state !== 'expanded') {
      send({ type: 'CLICK' })
    } else {
      send({ type: 'OUTSIDE' })
    }
  }, [state, send])

  const sendMediaCommand = useCallback((cmd: MediaCommand): void => {
    void window.island.media.command(cmd).catch((err: unknown) => {
      console.error('[media] command failed', err)
    })
  }, [])

  const runLauncherCommand = useCallback(
    async (command: string): Promise<void> => {
      try {
        const result = await window.island.launcher.run(command)
        if (!result.ok && result.results.length === 0) {
          send({
            type: 'ALERT',
            payload: {
              title: "Couldn't understand command",
              message: result.reason ?? undefined,
              type: 'error'
            }
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        send({ type: 'ALERT', payload: { title: 'App command failed', message, type: 'error' } })
      }
    },
    [send]
  )

  const refreshLauncherIndex = useCallback(async (): Promise<void> => {
    try {
      await window.island.launcher.refresh()
      send({
        type: 'ALERT',
        payload: {
          title: 'Apps refreshed',
          message: 'The app index is up to date',
          type: 'success'
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      send({ type: 'ALERT', payload: { title: 'App refresh failed', message, type: 'error' } })
    }
  }, [send])

  return (
    <div className="island-container">
      <motion.div
        className={`island-pill island-state--${state}`}
        layout
        animate={{
          width: size.width,
          height: size.height,
          borderRadius: size.borderRadius,
          boxShadow: `0 4px 24px 0 ${glowColor}, 0 2px 8px rgba(0,0,0,0.6)`
        }}
        transition={SPRING}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onMouseMove={handleExpandedActivity}
        onPointerDown={handleExpandedActivity}
        onKeyDown={handleExpandedActivity}
        onAnimationComplete={() => setContentReadyState(state)}
      >
        {/* Gloss overlay */}
        <div className="island-gloss" />
        {/* Specular glint */}
        <div className="island-glint" />

        {/* Content area – fades in after shape settles */}
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            className="island-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: contentVisible ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
          >
            {state === 'idle' && null}
            {state === 'compact' &&
              (launcherStatus ? (
                <LauncherCompactWidget status={launcherStatus} />
              ) : activities.activity ? (
                <ActivityCompactWidget activity={activities.activity} config={activities.config} />
              ) : media ? (
                <MediaCompactWidget media={media} />
              ) : (
                <span className="island-label">Mino</span>
              ))}
            {state === 'listening' && (
              <div className="island-listening">
                {voice.status === 'loading' ? (
                  <>
                    {voice.capturing && (
                      <span className="island-mic-indicator" aria-label="Microphone active" />
                    )}
                    <span className="island-label">Loading voice…</span>
                  </>
                ) : (
                  <>
                    <span className="island-mic-indicator" aria-label="Microphone active" />
                    <div className="island-listening-bars" aria-hidden="true">
                      {Array.from({ length: 5 }, (_, index) => (
                        <span
                          key={index}
                          style={{
                            transform: `scaleY(${Math.max(
                              0.18,
                              Math.min(1, voice.micLevel * (24 + index * 3))
                            )})`
                          }}
                        />
                      ))}
                    </div>
                    <span className="island-label">
                      {voice.capturing ? voice.transcript || 'Listening…' : 'Starting microphone…'}
                    </span>
                  </>
                )}
              </div>
            )}
            {state === 'expanded' && (
              <div
                className="island-expanded-content island-expanded-content--activities"
                onClick={handleExpandedContentClick}
              >
                <div className="island-expanded-system-widgets">
                  <ClockWidget />
                  <BatteryWidget percent={battery.percent} charging={battery.charging} />
                </div>
                {media && !activities.activity && (
                  <MediaExpandedWidget media={media} onCommand={sendMediaCommand} />
                )}
                <ActivityWidgets
                  activity={activities.activity}
                  config={activities.config}
                  completedRounds={activities.stats?.completedRounds ?? 0}
                  sendCommand={activities.sendCommand}
                />
              </div>
            )}
            {state === 'alert' && snapshot.context.alert && (
              <div className="island-alert-content">
                <span className="island-alert-title">{snapshot.context.alert.title}</span>
                {snapshot.context.alert.message && (
                  <span className="island-alert-message">{snapshot.context.alert.message}</span>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        {voice.wakeWordActive && state !== 'listening' && (
          <span
            className="island-mic-indicator island-wake-word-indicator"
            aria-label="Wake-word microphone active"
            title="Wake-word microphone active"
          />
        )}
      </motion.div>

      {/* Dev panel */}
      <DevPanel
        send={send}
        currentState={state}
        onSimulateMedia={setMedia}
        onLauncherCommand={runLauncherCommand}
        onRefreshLauncher={refreshLauncherIndex}
        onStartVoice={voice.start}
        onVisibilityChange={setDevPanelVisible}
        onActivity={handleExpandedActivity}
      />
    </div>
  )
}

function LauncherCompactWidget({ status }: { status: LauncherStatus }): React.JSX.Element {
  const busy = status.phase === 'opening' || status.phase === 'closing'
  const label =
    status.phase === 'opening'
      ? 'Opening'
      : status.phase === 'opened'
        ? 'Opened'
        : status.phase === 'closing'
          ? 'Closing'
          : status.phase === 'closed'
            ? 'Closed'
            : 'Opening'

  return (
    <div className="launcher-compact">
      {status.iconDataUrl ? (
        <img src={status.iconDataUrl} alt="" />
      ) : (
        <span className="launcher-compact-icon" aria-hidden="true">
          ▣
        </span>
      )}
      <span>{busy ? `${label} ${status.name}…` : `${label} ${status.name}`}</span>
      {!busy && (
        <span className="launcher-compact-check" aria-label="Done">
          ✓
        </span>
      )}
    </div>
  )
}

/* ── Dev Panel (toggle with backtick `) ── */

function DevPanel({
  send,
  currentState,
  onSimulateMedia,
  onLauncherCommand,
  onRefreshLauncher,
  onStartVoice,
  onVisibilityChange,
  onActivity
}: {
  send: (event: IslandEvent) => void
  currentState: IslandState
  onSimulateMedia: (media: MediaInfo | null) => void
  onLauncherCommand: (command: string) => Promise<void>
  onRefreshLauncher: () => Promise<void>
  onStartVoice: () => void
  onVisibilityChange: (visible: boolean) => void
  onActivity: () => void
}): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const [launcherCommand, setLauncherCommand] = useState('')

  const submitLauncherCommand = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const command = launcherCommand.trim()
    if (!command) return
    setLauncherCommand('')
    void onLauncherCommand(command)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === '`') {
        setVisible((current) => {
          const next = !current
          onVisibilityChange(next)
          return next
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onVisibilityChange])

  if (!visible) return <></>

  return (
    <div className="dev-panel" onMouseMove={onActivity} onKeyDown={onActivity}>
      <div className="dev-panel-title">Dev Panel (`) — State: {currentState}</div>
      <form className="dev-panel-launcher" onSubmit={submitLauncherCommand}>
        <input
          aria-label="App command"
          placeholder="open chrome and notepad"
          value={launcherCommand}
          onChange={(event) => setLauncherCommand(event.target.value)}
        />
        <button type="submit">Run</button>
        <button type="button" onClick={() => void onRefreshLauncher()}>
          Refresh Apps
        </button>
      </form>
      <div className="dev-panel-buttons">
        <button onClick={() => send({ type: 'HOVER' })}>HOVER</button>
        <button onClick={() => send({ type: 'CLICK' })}>CLICK</button>
        <button onClick={() => send({ type: 'OUTSIDE' })}>OUTSIDE</button>
        <button onClick={onStartVoice}>VOICE TEST</button>
        <button
          onClick={() =>
            send({
              type: 'ALERT',
              payload: { title: 'Battery Low', message: '15% remaining', type: 'warning' }
            })
          }
        >
          ALERT (warning)
        </button>
        <button
          onClick={() =>
            send({
              type: 'ALERT',
              payload: { title: 'Timer Done!', type: 'success' }
            })
          }
        >
          ALERT (success)
        </button>
        <button onClick={() => send({ type: 'DISMISS' })}>DISMISS</button>
        {/* Media simulation buttons */}
        <button
          onClick={() => {
            onSimulateMedia({ title: 'Blinding Lights', artist: 'The Weeknd', status: 'Playing' })
            send({ type: 'ACTIVITY_START' })
          }}
        >
          MEDIA Playing
        </button>
        <button
          onClick={() =>
            onSimulateMedia({ title: 'Blinding Lights', artist: 'The Weeknd', status: 'Paused' })
          }
        >
          MEDIA Paused
        </button>
        <button
          onClick={() => {
            onSimulateMedia(null)
            send({ type: 'ACTIVITY_STOP' })
          }}
        >
          MEDIA None
        </button>
      </div>
    </div>
  )
}
