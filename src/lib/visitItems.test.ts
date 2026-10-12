// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VisitDiscussion, VisitRemark } from '../types/models'
import { appendItem, editItem, newItemId, removeItem } from './visitItems'

describe('newItemId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' })

    expect(newItemId()).toBe('uuid-1')
  })

  it('still gives distinct ids outside a secure context (no crypto.randomUUID)', () => {
    vi.stubGlobal('crypto', {})

    const ids = new Set(Array.from({ length: 50 }, () => newItemId()))

    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
  })
})

describe('visit item changes', () => {
  // What the other parent saved meanwhile, unknown to this phone.
  const stored: VisitRemark[] = [
    { id: 'r1', text: 'Good weight' },
    { id: 'r2', text: 'Added on the other phone' },
  ]

  it('appends an item after the stored ones', () => {
    expect(appendItem<VisitRemark>({ id: 'r3', text: 'New' })(stored)).toEqual([
      ...stored,
      { id: 'r3', text: 'New' },
    ])
  })

  it('edits only its own item', () => {
    expect(editItem<VisitRemark>('r1', { text: 'Very good weight' })(stored)).toEqual([
      { id: 'r1', text: 'Very good weight' },
      { id: 'r2', text: 'Added on the other phone' },
    ])
  })

  it('keeps the untouched fields of the stored item', () => {
    const discussions: VisitDiscussion[] = [{ id: 'd1', question: 'Vitamin D?', answer: '' }]

    expect(editItem<VisitDiscussion>('d1', { answer: 'Until 18 months' })(discussions)).toEqual([
      { id: 'd1', question: 'Vitamin D?', answer: 'Until 18 months' },
    ])
  })

  it('changes nothing when the edited item was deleted meanwhile', () => {
    expect(editItem<VisitRemark>('gone', { text: 'x' })(stored)).toEqual(stored)
  })

  it('removes only its own item', () => {
    expect(removeItem<VisitRemark>('r1')(stored)).toEqual([{ id: 'r2', text: 'Added on the other phone' }])
  })
})
