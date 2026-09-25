import type { SourceSquare } from './photoCrop'

export const PHOTO_OUTPUT_SIZE = 320
const JPEG_QUALITY = 0.85

/** Draws the chosen square of `image` into a small JPEG data URL. */
export function exportCroppedPhoto(image: HTMLImageElement, square: SourceSquare): string {
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_OUTPUT_SIZE
  canvas.height = PHOTO_OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')
  context.drawImage(image, square.x, square.y, square.size, square.size, 0, 0, PHOTO_OUTPUT_SIZE, PHOTO_OUTPUT_SIZE)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
