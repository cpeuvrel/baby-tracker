import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportCroppedPhoto, PHOTO_OUTPUT_SIZE } from './photoExport'

const image = document.createElement('img')
const square = { x: 10, y: 20, size: 200 }

describe('exportCroppedPhoto', () => {
  const drawImage = vi.fn()
  const canvases: HTMLCanvasElement[] = []
  let getContext: ReturnType<typeof vi.spyOn>
  let toDataURL: ReturnType<typeof vi.spyOn>

  // jsdom has no canvas: the prototype is stubbed (and restored with the spies) per test.
  beforeEach(() => {
    drawImage.mockReset()
    canvases.length = 0
    getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      canvases.push(this)
      return { drawImage } as never
    } as never)
    toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAA')
  })

  it('draws the chosen square into a 320x320 canvas', () => {
    exportCroppedPhoto(image, square)

    expect(getContext).toHaveBeenCalledWith('2d')
    expect(drawImage).toHaveBeenCalledWith(image, 10, 20, 200, 200, 0, 0, 320, 320)
    expect(PHOTO_OUTPUT_SIZE).toBe(320)
    expect(canvases).toHaveLength(1)
    expect(canvases[0].width).toBe(320)
    expect(canvases[0].height).toBe(320)
  })

  it('returns the canvas as a JPEG data URL at 0.85 quality', () => {
    const dataUrl = exportCroppedPhoto(image, square)

    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85)
    expect(dataUrl).toBe('data:image/jpeg;base64,AAA')
  })

  it('throws when the canvas has no 2d context, without exporting anything', () => {
    getContext.mockReturnValue(null)

    expect(() => exportCroppedPhoto(image, square)).toThrow('Canvas is not available')
    expect(toDataURL).not.toHaveBeenCalled()
  })
})
