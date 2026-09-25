import { doc, getDocs, writeBatch } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { batchDeleteAll, batchInsert } from './firestoreBatch'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, writeBatch: vi.fn(), doc: vi.fn(), getDocs: vi.fn() }
})

const writeBatchMock = vi.mocked(writeBatch)
const docMock = vi.mocked(doc)
const getDocsMock = vi.mocked(getDocs)

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

describe('batchDeleteAll', () => {
  beforeEach(() => {
    writeBatchMock.mockReset()
    getDocsMock.mockReset()
  })

  function mockDocs(count: number) {
    const docs = Array.from({ length: count }, (_, i) => ({ ref: { id: `d${i}` } }))
    getDocsMock.mockResolvedValue({ docs } as unknown as Awaited<ReturnType<typeof getDocs>>)
  }

  it('deletes every document across batches of at most 450 and returns the count', async () => {
    mockDocs(451)
    const del = vi.fn()
    const commit = vi.fn().mockResolvedValue(undefined)
    writeBatchMock.mockReturnValue({ delete: del, commit } as unknown as ReturnType<typeof writeBatch>)

    const deleted = await batchDeleteAll({} as never)

    expect(deleted).toBe(451)
    expect(writeBatchMock).toHaveBeenCalledTimes(2)
    expect(commit).toHaveBeenCalledTimes(2)
    expect(del).toHaveBeenCalledTimes(451)
    expect(del).toHaveBeenCalledWith({ id: 'd0' })
  })

  it('does nothing for an empty collection', async () => {
    mockDocs(0)

    expect(await batchDeleteAll({} as never)).toBe(0)
    expect(writeBatchMock).not.toHaveBeenCalled()
  })
})
