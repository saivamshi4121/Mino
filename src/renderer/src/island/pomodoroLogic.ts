export type PomodoroPhase = 'focus' | 'break' | 'longBreak'

export interface PomodoroTransition {
  phase: PomodoroPhase
  cycleRound: number
}

export function getNextPomodoroPhase(
  currentPhase: PomodoroPhase,
  cycleRound: number,
  roundsUntilLongBreak: number,
  focusRoundCompleted = true
): PomodoroTransition {
  if (currentPhase === 'focus') {
    const nextRound = cycleRound + (focusRoundCompleted ? 1 : 0)
    return {
      phase: nextRound >= roundsUntilLongBreak ? 'longBreak' : 'break',
      cycleRound: nextRound
    }
  }

  return {
    phase: 'focus',
    cycleRound: currentPhase === 'longBreak' ? 0 : cycleRound
  }
}
