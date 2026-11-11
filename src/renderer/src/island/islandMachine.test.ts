import { createActor, SimulatedClock } from 'xstate'
import { describe, expect, it } from 'vitest'
import { islandMachine } from './islandMachine'

describe('island activity priority', () => {
  it('enters listening and returns to idle when voice capture ends', () => {
    const actor = createActor(islandMachine)
    actor.start()

    actor.send({ type: 'LISTEN_START' })
    expect(actor.getSnapshot().value).toBe('listening')

    actor.send({ type: 'LISTEN_END' })
    expect(actor.getSnapshot().value).toBe('idle')

    actor.stop()
  })

  it('returns to an active compact activity after voice capture', () => {
    const actor = createActor(islandMachine)
    actor.start()

    actor.send({ type: 'ACTIVITY_START' })
    actor.send({ type: 'LISTEN_START' })
    actor.send({ type: 'LISTEN_END' })
    expect(actor.getSnapshot().value).toBe('compact')

    actor.stop()
  })

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

  it('summons the full island and auto-collapses after four seconds', () => {
    const clock = new SimulatedClock()
    const actor = createActor(islandMachine, { clock })
    actor.start()

    actor.send({ type: 'SUMMON' })
    expect(actor.getSnapshot().value).toBe('expanded')
    clock.increment(4000)
    expect(actor.getSnapshot().value).toBe('idle')

    actor.stop()
  })

  it('returns to glance after summon when an activity is active', () => {
    const clock = new SimulatedClock()
    const actor = createActor(islandMachine, { clock })
    actor.start()

    actor.send({ type: 'ACTIVITY_START' })
    actor.send({ type: 'SUMMON' })
    expect(actor.getSnapshot().value).toBe('expanded')
    clock.increment(4000)
    expect(actor.getSnapshot().value).toBe('compact')

    actor.stop()
  })
})
