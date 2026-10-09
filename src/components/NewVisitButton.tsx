import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NewVisitModal } from './NewVisitModal'

/** Floating "New Visit" button, bottom right of the pediatrician screens. */
export function NewVisitButton() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <button type="button" className="fab" aria-label="New Visit" onClick={() => setCreating(true)}>
        <span aria-hidden="true">+</span> New
      </button>
      {creating && (
        <NewVisitModal
          onClose={() => setCreating(false)}
          onCreated={(visitId) => {
            // From a visit screen, the new visit opens in the same (still mounted) page: close explicitly.
            setCreating(false)
            navigate(`/account/pediatrician/visits/${visitId}`)
          }}
        />
      )}
    </>
  )
}
