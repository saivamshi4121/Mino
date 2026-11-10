import { createActor, SimulatedClock } from 'xstate'
import { describe, expect, it } from 'vitest'
import { islandMachine } from './islandMachine'

describe('island activity priority', () => {
  it('keeps an active countdown compact past the idle timeout', () => {
    const clock = new SimulatedClock()
    const actor = createActor(islandMachine, { clock })
    actor.start()

    actor.send({ type: 'ACTIVITY_START' })
    clock.increment(5000)
    expect(actor.getSnapshot().value).toBe('compact')

    actor.stop()
  })

  it('returns to the active countdown after an alert', () => {
    const clock = new SimulatedClock()
    const actor = createActor(islandMachine, { clock })
    actor.start()

    actor.send({ type: 'ACTIVITY_START' })
    actor.send({
      type: 'ALERT',
      payload: { title: "Time's up" }
    })
    clock.increment(5000)
    expect(actor.getSnapshot().value).toBe('compact')

    actor.stop()
  })

  it('collapses to idle after the activity stops', () => {
    const clock = new SimulatedClock()
    const actor = createActor(islandMachine, { clock })
    actor.start()

    actor.send({ type: 'ACTIVITY_START' })
    actor.send({ type: 'ACTIVITY_STOP' })
    expect(actor.getSnapshot().value).toBe('idle')

    actor.stop()
  })
})
