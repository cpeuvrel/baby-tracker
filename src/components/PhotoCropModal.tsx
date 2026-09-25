import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { clampOffset, MAX_ZOOM, MIN_ZOOM, sourceSquare, type Offset, type Size } from '../lib/photoCrop'
import { exportCroppedPhoto } from '../lib/photoExport'
import { Modal } from './Modal'

const VIEWPORT_SIZE = 280
const WHEEL_ZOOM_STEP = 0.0015

function distance(a: Offset, b: Offset): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

interface PhotoCropModalProps {
  file: File
  onCancel: () => void
  onSave: (photoDataUrl: string) => void
}

/** Drag to move, pinch / slider / wheel to zoom, then crop to a square photo. */
export function PhotoCropModal({ file, onCancel, onSave }: PhotoCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageSize, setImageSize] = useState<Size | null>(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const pointers = useRef(new Map<number, Offset>())
  const gesture = useRef<{ offset: Offset; zoom: number; pinchDistance: number | null; origin: Offset } | null>(null)

  // Created in the effect (not in state init) so StrictMode's re-run gets a fresh, unrevoked URL.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const applyZoom = (nextZoom: number, baseOffset = offset) => {
    if (!imageSize) return
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
    setZoom(clampedZoom)
    setOffset(clampOffset(baseOffset, imageSize, VIEWPORT_SIZE, clampedZoom))
  }

  const startGesture = () => {
    const points = [...pointers.current.values()]
    gesture.current = {
      offset,
      zoom,
      pinchDistance: points.length >= 2 ? distance(points[0], points[1]) : null,
      origin: points[0],
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    startGesture()
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current || !imageSize) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointers.current.values()]
    const start = gesture.current
    if (points.length >= 2 && start.pinchDistance) {
      applyZoom((start.zoom * distance(points[0], points[1])) / start.pinchDistance, start.offset)
      return
    }
    const moved = { x: start.offset.x + points[0].x - start.origin.x, y: start.offset.y + points[0].y - start.origin.y }
    setOffset(clampOffset(moved, imageSize, VIEWPORT_SIZE, zoom))
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size > 0) startGesture()
    else gesture.current = null
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    applyZoom(zoom * (1 - event.deltaY * WHEEL_ZOOM_STEP))
  }

  const handleSave = () => {
    if (!imageRef.current || !imageSize) return
    try {
      onSave(exportCroppedPhoto(imageRef.current, sourceSquare(imageSize, VIEWPORT_SIZE, zoom, offset)))
    } catch {
      setError('This photo could not be processed. Try another one.')
    }
  }

  const displayWidth = imageSize ? (imageSize.width / Math.min(imageSize.width, imageSize.height)) * VIEWPORT_SIZE : 0
  const displayHeight = imageSize ? (imageSize.height / Math.min(imageSize.width, imageSize.height)) * VIEWPORT_SIZE : 0

  return (
    <Modal
      title="Move and Scale"
      bandColorVar="--card-bg"
      onClose={onCancel}
      headerAction={{ label: 'Save', onClick: handleSave, disabled: !imageSize }}
    >
      <div
        className="photo-crop-viewport"
        style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {imageUrl && (
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Photo to crop"
            draggable={false}
            onLoad={(event) =>
              setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
            }
            onError={() => setError('This file is not a supported image.')}
            style={{
              width: displayWidth,
              height: displayHeight,
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            }}
          />
        )}
      </div>
      <label htmlFor="photo-zoom" className="photo-crop-zoom-label">
        Zoom
      </label>
      <input
        id="photo-zoom"
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        disabled={!imageSize}
        onChange={(event) => applyZoom(Number(event.target.value))}
      />
      <p className="hint">Drag to move, pinch or slide to zoom.</p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </Modal>
  )
}
