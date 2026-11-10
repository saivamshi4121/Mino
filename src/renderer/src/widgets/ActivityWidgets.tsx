import { useState, type FormEvent } from 'react'
import type { ActivityCommand } from '../../../shared/moduleEvents'
import type { PomodoroPhase } from '../island/pomodoroLogic'
import type { ActiveActivity } from '../island/useActivities'

interface ActivityWidgetsProps {
  activity: ActiveActivity | null
  config: {
    focusMinutes: number
    breakMinutes: number
    longBreakMinutes: number
    roundsUntilLongBreak: number
  }
  completedRounds: number
  sendCommand: (command: ActivityCommand) => void
}

function formatTime(milliseconds: number): string {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function phaseLabel(phase: PomodoroPhase | null): string {
  if (phase === 'focus') return 'Focus'
  if (phase === 'longBreak') return 'Long break'
  return 'Break'
}

function Ring({ progress }: { progress: number }): React.JSX.Element {
  const circumference = 2 * Math.PI * 14
  return (
    <svg className="activity-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle className="activity-ring-track" cx="18" cy="18" r="14" />
      <circle
        className="activity-ring-progress"
        cx="18"
        cy="18"
        r="14"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
      />
    </svg>
  )
}

function RoundDots({ count, filled }: { count: number; filled: number }): React.JSX.Element {
  return (
    <span className="pomodoro-round-dots" aria-label={`${filled} of ${count} rounds`}>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={
            index < filled ? 'pomodoro-round-dot pomodoro-round-dot--filled' : 'pomodoro-round-dot'
          }
        />
      ))}
    </span>
  )
}

export function ActivityCompactWidget({
  activity,
  config
}: Pick<ActivityWidgetsProps, 'activity' | 'config'>): React.JSX.Element | null {
  if (!activity) return null
  const roundsUntilLongBreak = config.roundsUntilLongBreak
  const progress =
    activity.durationMs > 0 ? Math.min(1, activity.remainingMs / activity.durationMs) : 0
  const round = Math.min(
    roundsUntilLongBreak,
    activity.cycleRound + (activity.phase === 'focus' ? 1 : 0)
  )
  const className =
    activity.mode === 'pomodoro'
      ? `activity-compact activity-compact--${activity.phase}`
      : 'activity-compact activity-compact--timer'

  return (
    <div className={className}>
      <span className="activity-ring-wrap">
        <Ring progress={progress} />
      </span>
      <span className="activity-compact-time">{formatTime(activity.remainingMs)}</span>
      {activity.mode === 'pomodoro' && (
        <span className="activity-compact-rounds">
          <span className="activity-compact-phase">{phaseLabel(activity.phase)}</span>
          <RoundDots count={roundsUntilLongBreak} filled={round} />
        </span>
      )}
      {!activity.running && <span className="activity-paused-label">Paused</span>}
    </div>
  )
}

export default function ActivityWidgets({
  activity,
  config,
  completedRounds,
  sendCommand
}: ActivityWidgetsProps): React.JSX.Element {
  const [minutes, setMinutes] = useState('5')

  const startTimer = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const value = Number(minutes)
    if (Number.isInteger(value) && value >= 1 && value <= 24 * 60) {
      sendCommand({ type: 'timer.start', minutes: value })
    }
  }

  const isTimer = activity?.mode === 'timer'
  const isPomodoro = activity?.mode === 'pomodoro'

  return (
    <div className="activity-panel">
      <section className="activity-card">
        <div className="activity-card-heading">Timer</div>
        {isTimer ? (
          <>
            <div className="activity-card-status">
              {formatTime(activity.remainingMs)} · {activity.running ? 'Running' : 'Paused'}
            </div>
            <div className="activity-controls">
              <button
                onClick={() =>
                  sendCommand({ type: activity.running ? 'timer.pause' : 'timer.resume' })
                }
              >
                {activity.running ? 'Pause' : 'Start'}
              </button>
              <button onClick={() => sendCommand({ type: 'timer.cancel' })}>Cancel</button>
            </div>
          </>
        ) : (
          <form className="activity-timer-form" onSubmit={startTimer}>
            <label>
              <input
                aria-label="Timer minutes"
                type="number"
                min="1"
                max={24 * 60}
                step="1"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                required
              />
              <span>min</span>
            </label>
            <button type="submit">Start</button>
          </form>
        )}
      </section>

      <section className="activity-card activity-card--pomodoro">
        <div className="activity-card-heading">Pomodoro</div>
        <div className="activity-card-status">
          {isPomodoro
            ? `${phaseLabel(activity.phase)} · ${formatTime(activity.remainingMs)}`
            : `${completedRounds} completed today`}
        </div>
        {isPomodoro && (
          <RoundDots
            count={config.roundsUntilLongBreak}
            filled={Math.min(
              config.roundsUntilLongBreak,
              activity.cycleRound + (activity.phase === 'focus' ? 1 : 0)
            )}
          />
        )}
        <div className="activity-controls">
          {isPomodoro ? (
            <>
              <button
                onClick={() =>
                  sendCommand({ type: activity.running ? 'pomodoro.pause' : 'pomodoro.start' })
                }
              >
                {activity.running ? 'Pause' : 'Start'}
              </button>
              <button onClick={() => sendCommand({ type: 'pomodoro.skip' })}>Skip</button>
              <button onClick={() => sendCommand({ type: 'pomodoro.reset' })}>Reset</button>
            </>
          ) : (
            <button onClick={() => sendCommand({ type: 'pomodoro.start' })}>Start focus</button>
          )}
        </div>
      </section>
    </div>
  )
}
