import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMachine } from '@xstate/react'
import { islandMachine, ISLAND_SIZES, type IslandState, type IslandEvent } from './islandMachine'
import type { IslandModuleEvent } from '../../../shared/moduleEvents'
import BatteryWidget from '../widgets/BatteryWidget'
import ClockWidget from '../widgets/ClockWidget'
import ActivityWidgets, { ActivityCompactWidget } from '../widgets/ActivityWidgets'
import { useActivities } from './useActivities'

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
  const size = ISLAND_SIZES[state]
  const [contentReadyState, setContentReadyState] = useState<IslandState | null>(null)
  const contentVisible = contentReadyState === state
  const activities = useActivities(send)
  const { handleModuleEvent: handleActivityModuleEvent } = activities
  const glowColor =
    state === 'compact' && activities.activity?.mode === 'pomodoro'
      ? activities.activity.phase === 'focus'
        ? 'rgba(248,113,113,0.3)'
        : 'rgba(74,222,128,0.28)'
      : GLOW_COLORS[state]
  const [battery, setBattery] = useState<{ percent: number | null; charging: boolean }>({
    percent: null,
    charging: false
  })

  useEffect(() => {
    const handleModuleEvent = (event: IslandModuleEvent): void => {
      if (event.type === 'battery.update') {
        setBattery(event.payload)
      } else if (event.type === 'ALERT') {
        send({ type: 'ALERT', payload: event.payload })
      } else {
        handleActivityModuleEvent(event)
      }
    }
    return window.island.onModuleEvent(handleModuleEvent)
  }, [handleActivityModuleEvent, send])

  const handleMouseEnter = useCallback((): void => {
    window.island.setHover(true)
    if (state === 'idle') send({ type: 'HOVER' })
  }, [state, send])

  const handleMouseLeave = useCallback((): void => {
    window.island.setHover(false)
    if (state === 'compact' && !activities.activity) send({ type: 'OUTSIDE' })
  }, [activities.activity, state, send])

  const handleClick = useCallback((): void => {
    if (state === 'alert') {
      send({ type: 'DISMISS' })
    } else if (state !== 'expanded') {
      send({ type: 'CLICK' })
    } else {
      send({ type: 'OUTSIDE' })
    }
  }, [state, send])

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
              (activities.activity ? (
                <ActivityCompactWidget activity={activities.activity} config={activities.config} />
              ) : (
                <span className="island-label">Mino</span>
              ))}
            {state === 'listening' && (
              <div className="island-listening">
                <div className="island-listening-bars">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <span className="island-label">Listening…</span>
              </div>
            )}
            {state === 'expanded' && (
              <div className="island-expanded-content island-expanded-content--activities">
                <div className="island-expanded-system-widgets">
                  <ClockWidget />
                  <BatteryWidget percent={battery.percent} charging={battery.charging} />
                </div>
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
      </motion.div>

      {/* Dev panel */}
      <DevPanel send={send} currentState={state} />
    </div>
  )
}

/* ── Dev Panel (toggle with backtick `) ── */

function DevPanel({
  send,
  currentState
}: {
  send: (event: IslandEvent) => void
  currentState: IslandState
}): React.JSX.Element {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === '`') setVisible((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!visible) return <></>

  return (
    <div className="dev-panel">
      <div className="dev-panel-title">Dev Panel (`) — State: {currentState}</div>
      <div className="dev-panel-buttons">
        <button onClick={() => send({ type: 'HOVER' })}>HOVER</button>
        <button onClick={() => send({ type: 'CLICK' })}>CLICK</button>
        <button onClick={() => send({ type: 'OUTSIDE' })}>OUTSIDE</button>
        <button onClick={() => send({ type: 'LISTEN_START' })}>LISTEN_START</button>
        <button onClick={() => send({ type: 'LISTEN_END' })}>LISTEN_END</button>
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
      </div>
    </div>
  )
}
