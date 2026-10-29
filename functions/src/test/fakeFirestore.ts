import { Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore'

/**
 * Just enough of the Admin Firestore API for the schedulers' tests: documents
 * kept in memory by path, collection queries with `where`/`limit`, reads,
 * updates and deletes. `failOn(path)` makes the reads/writes of a path reject.
 */
type Data = Record<string, unknown>
type Op = '==' | '<' | '<=' | '>' | '>='

function comparable(value: unknown): unknown {
  if (value != null && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis(): number }).toMillis()
  }
  return value
}

function matches(actual: unknown, op: Op, expected: unknown): boolean {
  const a = comparable(actual) as number | string | null | undefined
  const b = comparable(expected) as number | string | null
  if (op === '==') return (a ?? null) === b
  if (a == null || b == null) return false
  if (op === '<') return a < b
  if (op === '<=') return a <= b
  if (op === '>') return a > b
  return a >= b
}

export class FakeFirestore {
  readonly docs = new Map<string, Data>()
  readonly deleted: string[] = []
  failOn: (path: string) => boolean = () => false
  /** The server time of every query read (`QuerySnapshot.readTime`). */
  readTime = Timestamp.fromDate(new Date('2026-03-05T22:30:00Z'))

  constructor(docs: Record<string, Data> = {}) {
    for (const [path, data] of Object.entries(docs)) this.docs.set(path, data)
  }

  collection(path: string): FakeQuery {
    return new FakeQuery(this, path)
  }

  doc(path: string): FakeDocRef {
    return new FakeDocRef(this, path)
  }

  check(path: string): void {
    if (this.failOn(path)) throw new Error(`Firestore failure on ${path}`)
  }

  /** Typed as the real thing for the code under test. */
  asFirestore(): Firestore {
    return this as unknown as Firestore
  }
}

export class FakeDocRef {
  constructor(
    readonly firestore: FakeFirestore,
    readonly path: string,
  ) {}

  get id(): string {
    const segments = this.path.split('/')
    return segments[segments.length - 1]
  }

  get parent(): FakeQuery {
    return new FakeQuery(this.firestore, this.path.split('/').slice(0, -1).join('/'))
  }

  collection(name: string): FakeQuery {
    return new FakeQuery(this.firestore, `${this.path}/${name}`)
  }

  async get(): Promise<FakeDocSnapshot> {
    this.firestore.check(this.path)
    return new FakeDocSnapshot(this, this.firestore.docs.get(this.path))
  }

  async update(data: Data): Promise<void> {
    this.firestore.check(this.path)
    const current = this.firestore.docs.get(this.path)
    if (!current) throw new Error(`No document to update: ${this.path}`)
    this.firestore.docs.set(this.path, { ...current, ...data })
  }

  async delete(): Promise<void> {
    this.firestore.check(this.path)
    this.firestore.docs.delete(this.path)
    this.firestore.deleted.push(this.path)
  }

  asRef(): DocumentReference {
    return this as unknown as DocumentReference
  }
}

export class FakeDocSnapshot {
  constructor(
    readonly ref: FakeDocRef,
    private readonly fields: Data | undefined,
  ) {}

  get id(): string {
    return this.ref.id
  }

  get exists(): boolean {
    return this.fields !== undefined
  }

  data(): Data | undefined {
    return this.fields
  }
}

export class FakeQuery {
  constructor(
    readonly firestore: FakeFirestore,
    readonly path: string,
    private readonly filters: Array<[string, Op, unknown]> = [],
    private readonly max: number | null = null,
  ) {}

  get parent(): FakeDocRef | null {
    const segments = this.path.split('/')
    return segments.length > 1 ? new FakeDocRef(this.firestore, segments.slice(0, -1).join('/')) : null
  }

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.firestore, `${this.path}/${id}`)
  }

  where(field: string, op: Op, value: unknown): FakeQuery {
    return new FakeQuery(this.firestore, this.path, [...this.filters, [field, op, value]], this.max)
  }

  limit(max: number): FakeQuery {
    return new FakeQuery(this.firestore, this.path, this.filters, max)
  }

  async get(): Promise<{ docs: FakeDocSnapshot[]; empty: boolean; size: number; readTime: Timestamp }> {
    this.firestore.check(this.path)
    const depth = this.path.split('/').length + 1
    let docs = [...this.firestore.docs.entries()]
      .filter(([path]) => path.startsWith(`${this.path}/`) && path.split('/').length === depth)
      .filter(([, data]) => this.filters.every(([field, op, value]) => matches(data[field], op, value)))
      .map(([path, data]) => new FakeDocSnapshot(new FakeDocRef(this.firestore, path), data))
    if (this.max != null) docs = docs.slice(0, this.max)
    return { docs, empty: docs.length === 0, size: docs.length, readTime: this.firestore.readTime }
  }
}

/** Records the pushes a run sends, as `sendToHousehold` would get them. */
export function recordingSender() {
  const sent: Array<{ household: string; data: Record<string, string>; ttlSeconds: number }> = []
  const send = async (householdRef: DocumentReference, data: Record<string, string>, ttlSeconds: number) => {
    sent.push({ household: householdRef.path, data, ttlSeconds })
  }
  return { sent, send }
}
