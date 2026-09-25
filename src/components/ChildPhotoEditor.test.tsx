import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChildPhotoEditor } from './ChildPhotoEditor'

const updateBabyPhoto = vi.fn()
const exportCroppedPhoto = vi.fn()

vi.mock('../repositories/babies', () => ({
  updateBabyPhoto: (...args: unknown[]) => updateBabyPhoto(...args),
}))

vi.mock('../lib/photoExport', () => ({
  exportCroppedPhoto: (...args: unknown[]) => exportCroppedPhoto(...args),
}))

const baby = { id: 'b1', name: 'Maëlys', birthDate: '2026-01-11', sex: 'female' as const }

function loadImage(width: number, height: number) {
  const image = screen.getByAltText('Photo to crop')
  Object.defineProperty(image, 'naturalWidth', { value: width })
  Object.defineProperty(image, 'naturalHeight', { value: height })
  fireEvent.load(image)
}

describe('ChildPhotoEditor', () => {
  beforeEach(() => {
    updateBabyPhoto.mockReset()
    exportCroppedPhoto.mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:photo')
    URL.revokeObjectURL = vi.fn()
  })

  it('offers library and camera, and Delete only when there is a photo', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ChildPhotoEditor householdId="h1" baby={baby} />)

    await user.click(screen.getByRole('button', { name: 'Change Child Photo' }))
    const menu = within(screen.getByRole('dialog', { name: 'Change Child Photo' }))
    expect(menu.getByRole('button', { name: 'Choose From Library' })).toBeInTheDocument()
    expect(menu.getByRole('button', { name: 'Take Photo' })).toBeInTheDocument()
    expect(menu.queryByRole('button', { name: 'Delete Photo' })).not.toBeInTheDocument()

    rerender(<ChildPhotoEditor householdId="h1" baby={{ ...baby, photoDataUrl: 'data:image/jpeg;base64,AAA' }} />)
    await user.click(screen.getByRole('button', { name: 'Delete Photo' }))

    expect(updateBabyPhoto).toHaveBeenCalledWith('h1', 'b1', null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('takes a photo with the camera input', async () => {
    const user = userEvent.setup()
    render(<ChildPhotoEditor householdId="h1" baby={baby} />)

    expect(screen.getByTestId('photo-camera-input')).toHaveAttribute('capture', 'environment')
    const click = vi.spyOn(screen.getByTestId('photo-camera-input'), 'click')
    await user.click(screen.getByRole('button', { name: 'Change Child Photo' }))
    await user.click(screen.getByRole('button', { name: 'Take Photo' }))

    expect(click).toHaveBeenCalled()
  })

  it('crops a chosen picture, zoomed, and saves the result', async () => {
    exportCroppedPhoto.mockReturnValue('data:image/jpeg;base64,CROPPED')
    const user = userEvent.setup()
    render(<ChildPhotoEditor householdId="h1" baby={baby} />)

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByTestId('photo-library-input'), file)
    expect(screen.getByRole('dialog', { name: 'Move and Scale' })).toBeInTheDocument()
    loadImage(4000, 3000)

    fireEvent.change(screen.getByLabelText('Zoom'), { target: { value: '2' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(exportCroppedPhoto).toHaveBeenCalledWith(expect.anything(), { x: 1250, y: 750, size: 1500 })
    expect(updateBabyPhoto).toHaveBeenCalledWith('h1', 'b1', 'data:image/jpeg;base64,CROPPED')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('moves the picture by dragging, never past its edges', async () => {
    exportCroppedPhoto.mockReturnValue('data:image/jpeg;base64,CROPPED')
    const user = userEvent.setup()
    render(<ChildPhotoEditor householdId="h1" baby={baby} />)

    await user.upload(screen.getByTestId('photo-library-input'), new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))
    loadImage(4000, 3000)
    const viewport = screen.getByAltText('Photo to crop').parentElement as HTMLElement
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 1000, clientY: 100 })
    fireEvent.pointerUp(viewport, { pointerId: 1 })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Dragged fully right: the left edge of the photo is shown.
    const [, square] = exportCroppedPhoto.mock.calls[0]
    expect(square.x).toBeCloseTo(0)
    expect(square.y).toBeCloseTo(0)
    expect(square.size).toBeCloseTo(3000)
  })

  it('discards the picture on Close', async () => {
    const user = userEvent.setup()
    render(<ChildPhotoEditor householdId="h1" baby={baby} />)

    await user.upload(screen.getByTestId('photo-library-input'), new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(updateBabyPhoto).not.toHaveBeenCalled()
  })
})
