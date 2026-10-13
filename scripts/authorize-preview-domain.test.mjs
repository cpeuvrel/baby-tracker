import { describe, expect, it } from 'vitest'
import { nextAuthorizedDomains } from './authorize-preview-domain.mjs'

const preview = (name) => `baby-tracker-${name}-baby-tracker7.vercel.app`
const BASE = ['localhost', 'baby-tracker-c8fd2.firebaseapp.com', 'baby-tracker-baby-tracker7.vercel.app']

describe('nextAuthorizedDomains', () => {
  it('returns null when the host is already authorized', () => {
    expect(nextAuthorizedDomains([...BASE, preview('abc')], preview('abc'))).toBeNull()
  })

  it('appends a new preview host', () => {
    expect(nextAuthorizedDomains(BASE, preview('abc'))).toEqual([...BASE, preview('abc')])
  })

  it('keeps only the 9 most recent previews plus the new one', () => {
    const previews = Array.from({ length: 12 }, (_, i) => preview(`p${i}`))
    const next = nextAuthorizedDomains([...BASE, ...previews], preview('new'))

    expect(next).toEqual([...BASE, ...previews.slice(-9), preview('new')])
  })

  it('never drops production or unrelated domains, even when they look like previews', () => {
    const current = [
      ...BASE,
      'baby-tracker-git-main-baby-tracker7.vercel.app',
      'example.com',
      ...Array.from({ length: 10 }, (_, i) => preview(`p${i}`)),
    ]
    const next = nextAuthorizedDomains(current, preview('new'))

    expect(next).toContain('baby-tracker-git-main-baby-tracker7.vercel.app')
    expect(next).toContain('example.com')
    for (const domain of BASE) expect(next).toContain(domain)
    expect(next).not.toContain(preview('p0'))
    expect(next.at(-1)).toBe(preview('new'))
  })
})
