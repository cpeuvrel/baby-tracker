import { describe, expect, it } from 'vitest'
import { isWithinCheckWindow } from './index'

describe('isWithinCheckWindow', () => {
  it('matches when now equals the reminder time', () => {
    const now = new Date('2026-03-05T09:00:00')
    expect(isWithinCheckWindow('09:00', now, 15)).toBe(true)
  })

  it('matches within the interval after the reminder time', () => {
    const now = new Date('2026-03-05T09:10:00')
    expect(isWithinCheckWindow('09:00', now, 15)).toBe(true)
  })

  it('does not match once the interval has elapsed', () => {
    const now = new Date('2026-03-05T09:15:00')
    expect(isWithinCheckWindow('09:00', now, 15)).toBe(false)
  })

  it('does not match before the reminder time', () => {
    const now = new Date('2026-03-05T08:59:00')
    expect(isWithinCheckWindow('09:00', now, 15)).toBe(false)
  })
})
