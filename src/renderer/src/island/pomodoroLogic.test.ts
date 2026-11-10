import { describe, expect, it } from 'vitest'
import { getNextPomodoroPhase } from './pomodoroLogic'

describe('getNextPomodoroPhase', () => {
  it('starts a break after a completed focus round', () => {
    expect(getNextPomodoroPhase('focus', 0, 4)).toEqual({
      phase: 'break',
      cycleRound: 1
    })
  })

  it('starts a long break after the configured final round', () => {
    expect(getNextPomodoroPhase('focus', 3, 4)).toEqual({
      phase: 'longBreak',
      cycleRound: 4
    })
  })

  it('starts the next focus round after a short break', () => {
    expect(getNextPomodoroPhase('break', 2, 4)).toEqual({
      phase: 'focus',
      cycleRound: 2
    })
  })

  it('resets the cycle after a long break', () => {
    expect(getNextPomodoroPhase('longBreak', 4, 4)).toEqual({
      phase: 'focus',
      cycleRound: 0
    })
  })

  it('does not count a skipped focus round as completed', () => {
    expect(getNextPomodoroPhase('focus', 0, 4, false)).toEqual({
      phase: 'break',
      cycleRound: 0
    })
  })
})
