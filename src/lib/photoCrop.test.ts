import { describe, expect, it } from 'vitest'
import { clampOffset, displayScale, sourceSquare } from './photoCrop'

const landscape = { width: 4000, height: 3000 }

describe('displayScale', () => {
  it('fits the short side to the viewport at zoom 1, and scales with zoom', () => {
    expect(displayScale(landscape, 300, 1)).toBe(0.1)
    expect(displayScale(landscape, 300, 2)).toBe(0.2)
  })
})

describe('clampOffset', () => {
  it('lets a landscape photo slide sideways only as far as its edges', () => {
    expect(clampOffset({ x: 999, y: 40 }, landscape, 300, 1)).toEqual({ x: 50, y: 0 })
    expect(clampOffset({ x: -999, y: 0 }, landscape, 300, 1)).toEqual({ x: -50, y: 0 })
  })
})

describe('sourceSquare', () => {
  it('is the centered square of the short side at zoom 1', () => {
    expect(sourceSquare(landscape, 300, 1, { x: 0, y: 0 })).toEqual({ x: 500, y: 0, size: 3000 })
  })

  it('shrinks with zoom and follows the drag', () => {
    expect(sourceSquare(landscape, 300, 2, { x: 30, y: -30 })).toEqual({ x: 1100, y: 900, size: 1500 })
  })
})
