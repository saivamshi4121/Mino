import { describe, expect, it } from 'vitest'
import { containsPoint, getDockOffset, isNearRect } from './presence'

describe('presence geometry', () => {
  it('aligns the glance pill to its configured dock', () => {
    expect(getDockOffset('left', 640, 220)).toBe(0)
    expect(getDockOffset('center', 640, 220)).toBe(210)
    expect(getDockOffset('right', 640, 220)).toBe(420)
  })

  it('checks a pill hit area and its shy proximity buffer', () => {
    const pill = { x: 100, y: 8, width: 220, height: 38 }
    expect(containsPoint(pill, { x: 140, y: 20 })).toBe(true)
    expect(containsPoint(pill, { x: 80, y: 20 })).toBe(false)
    expect(isNearRect(pill, { x: 80, y: 20 }, 24)).toBe(true)
    expect(isNearRect(pill, { x: 70, y: 20 }, 24)).toBe(false)
  })
})
