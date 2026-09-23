import { doc, writeBatch } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { batchInsert } from './firestoreBatch'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, writeBatch: vi.fn(), doc: vi.fn() }
})

const writeBatchMock = vi.mocked(writeBatch)
const docMock = vi.mocked(doc)

describe('batchInsert', () => {
  beforeEach(() => {
    writeBatchMock.mockReset()
    docMock.mockReset()
    docMock.mockImplementation(() => ({ id: 'generated' }) as ReturnType<typeof doc>)
  })

  it('commits a single batch for a small list', async () => {
    const set = vi.fn()
    const commit = vi.fn().mockResolvedValue(undefined)
    writeBatchMock.mockReturnValue({ set, commit } as unknown as ReturnType<typeof writeBatch>)

    const items = [{ value: 'a' }, { value: 'b' }]
    await batchInsert({} as never, items, (item) => ({ value: item.value }))

    expect(writeBatchMock).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledTimes(2)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('splits a large list across multiple batches of at most 450 writes', async () => {
    const set = vi.fn()
    const commit = vi.fn().mockResolvedValue(undefined)
    writeBatchMock.mockReturnValue({ set, commit } as unknown as ReturnType<typeof writeBatch>)

    const items = Array.from({ length: 901 }, (_, i) => ({ value: i }))
    await batchInsert({} as never, items, (item) => ({ value: item.value }))

    expect(writeBatchMock).toHaveBeenCalledTimes(3)
    expect(commit).toHaveBeenCalledTimes(3)
    expect(set).toHaveBeenCalledTimes(901)
  })

  it('does nothing for an empty list', async () => {
    await batchInsert({} as never, [], () => ({}))

    expect(writeBatchMock).not.toHaveBeenCalled()
  })
})
