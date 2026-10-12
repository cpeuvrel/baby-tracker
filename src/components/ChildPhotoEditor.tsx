import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { updateBabyPhoto } from '../repositories/babies'
import type { Baby } from '../types/models'
import { BabyAvatarIcon, CameraIcon } from './icons'
import { PhotoCropModal } from './PhotoCropModal'

/** The child's round photo on the Child screen: tap to choose, take or delete it. */
export function ChildPhotoEditor({ householdId, baby }: { householdId: string; baby: Baby }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const photoButton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const { run, pending, error } = useAsyncAction('Could not save the photo. Try again.')

  const closeMenu = () => {
    setMenuOpen(false)
    photoButton.current?.focus()
  }

  // Keyboard: the menu takes the focus on its first choice, and Escape closes it.
  useEffect(() => {
    if (!menuOpen) return
    menu.current?.querySelector('button')?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      photoButton.current?.focus()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  const pick = (input: HTMLInputElement | null) => {
    setMenuOpen(false)
    input?.click()
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so picking the same file again still fires a change.
    event.target.value = ''
    if (file) setPickedFile(file)
  }

  const handleDelete = () => {
    setMenuOpen(false)
    void run(() => updateBabyPhoto(householdId, baby.id, null))
  }

  const handleSave = (photoDataUrl: string) => {
    setPickedFile(null)
    void run(() => updateBabyPhoto(householdId, baby.id, photoDataUrl))
  }

  return (
    <>
      <button
        ref={photoButton}
        type="button"
        className="child-photo-button"
        aria-label="Change Child Photo"
        disabled={pending}
        onClick={() => setMenuOpen(true)}
      >
        {baby.photoDataUrl ? <img src={baby.photoDataUrl} alt="" /> : <BabyAvatarIcon />}
        <span className="child-photo-badge" aria-hidden="true">
          <CameraIcon />
        </span>
      </button>
      {error && <p role="alert">{error}</p>}
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        hidden
        data-testid="photo-library-input"
        onChange={handleFile}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid="photo-camera-input"
        onChange={handleFile}
      />

      {menuOpen && (
        <div className="action-menu-overlay" onClick={closeMenu}>
          <div
            ref={menu}
            className="action-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Change Child Photo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Change Child Photo</h2>
            <button type="button" onClick={() => pick(libraryInput.current)}>
              Choose From Library
            </button>
            <button type="button" onClick={() => pick(cameraInput.current)}>
              Take Photo
            </button>
            {baby.photoDataUrl && (
              <button type="button" onClick={handleDelete}>
                Delete Photo
              </button>
            )}
            <button type="button" onClick={closeMenu}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {pickedFile && (
        <PhotoCropModal file={pickedFile} onCancel={() => setPickedFile(null)} onSave={handleSave} />
      )}
    </>
  )
}
