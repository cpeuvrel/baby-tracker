export interface Size {
  width: number
  height: number
}

export interface Offset {
  x: number
  y: number
}

export interface SourceSquare {
  x: number
  y: number
  size: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

/** Screen pixels per image pixel, so the image fills the square viewport at zoom 1. */
export function displayScale(image: Size, viewport: number, zoom: number): number {
  return (viewport / Math.min(image.width, image.height)) * zoom
}

/** Keeps the image covering the whole viewport (`offset` = image center relative to the viewport center). */
export function clampOffset(offset: Offset, image: Size, viewport: number, zoom: number): Offset {
  const scale = displayScale(image, viewport, zoom)
  const maxX = (image.width * scale - viewport) / 2
  const maxY = (image.height * scale - viewport) / 2
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

/** The square of the original image visible in the viewport. */
export function sourceSquare(image: Size, viewport: number, zoom: number, offset: Offset): SourceSquare {
  const scale = displayScale(image, viewport, zoom)
  const size = viewport / scale
  return {
    x: image.width / 2 - offset.x / scale - size / 2,
    y: image.height / 2 - offset.y / scale - size / 2,
    size,
  }
}
