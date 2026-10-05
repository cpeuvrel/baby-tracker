import { describe, expect, it } from 'vitest'
import { sleepChange } from './sleepTimer'

const at = (iso: string) => ({ toDate: () => new Date(iso) })
const running = (start: string) => ({ startedAt: at(start), endedAt: null })
const stopped = (start: string) => ({ startedAt: at(start), endedAt: at('2026-03-05T22:00:00Z') })

describe('sleepChange', () => {
  it('sees a timer start, or a stopped sleep resumed', () => {
    expect(sleepChange(undefined, running('2026-03-05T20:00:00Z'))).toBe('started')
    expect(sleepChange(stopped('2026-03-05T20:00:00Z'), running('2026-03-05T20:00:00Z'))).toBe('started')
  })

  it('sees a running timer stop or get deleted', () => {
    expect(sleepChange(running('2026-03-05T20:00:00Z'), stopped('2026-03-05T20:00:00Z'))).toBe('stopped')
    expect(sleepChange(running('2026-03-05T20:00:00Z'), undefined)).toBe('stopped')
  })

  it('sees the start of a running timer move', () => {
    expect(sleepChange(running('2026-03-05T20:00:00Z'), running('2026-03-05T19:30:00Z'))).toBe('moved')
  })

  it('ignores other edits and finished sleeps', () => {
    expect(sleepChange(running('2026-03-05T20:00:00Z'), running('2026-03-05T20:00:00Z'))).toBeNull()
    expect(sleepChange(undefined, stopped('2026-03-05T20:00:00Z'))).toBeNull()
    expect(sleepChange(stopped('2026-03-05T20:00:00Z'), stopped('2026-03-05T19:00:00Z'))).toBeNull()
  })
})
