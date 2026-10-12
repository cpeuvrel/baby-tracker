import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useReminder } from '../hooks/useReminder'
import { registerPush } from '../lib/pushRegistration'
import { setReminder } from '../repositories/reminders'
import { Modal } from './Modal'
import { TimeSelect } from './TimeSelect'

const DEFAULT_TIME_OF_DAY = '09:00'

// Typing "08:30" goes through 00:00, 08:00, 08:03: only the time the user
// settles on is saved (or the last one when the modal closes first).
export const TIME_SAVE_DELAY_MS = 800

type NotificationStatus = 'idle' | 'requesting' | 'enabled' | 'blocked' | 'failed'

function initialNotificationStatus(): NotificationStatus {
  if (typeof Notification === 'undefined') return 'idle'
  if (Notification.permission === 'denied') return 'blocked'
  return Notification.permission === 'granted' ? 'enabled' : 'idle'
}

interface ReminderSettingsModalProps {
  medicationName: string
  onClose: () => void
}

export function ReminderSettingsModal({ medicationName, onClose }: ReminderSettingsModalProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const reminder = useReminder(household?.id ?? null, selectedBaby?.id ?? null, medicationName)
  const [timeOfDay, setTimeOfDay] = useState(DEFAULT_TIME_OF_DAY)
  const [active, setActive] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>(initialNotificationStatus)
  const pendingSave = useRef<(() => void) | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const uid = user?.uid ?? null

  useEffect(() => {
    if (reminder) {
      setTimeOfDay(reminder.timeOfDay)
      setActive(reminder.active)
    }
  }, [reminder])

  const flushTimeSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    const save = pendingSave.current
    pendingSave.current = null
    save?.()
  }, [])

  // Closing the modal saves a time still waiting.
  useEffect(() => flushTimeSave, [flushTimeSave])

  // Notifications already allowed: make sure this device's token is on file.
  useEffect(() => {
    if (uid == null || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    registerPush(uid)
      .then((registered) => {
        if (!registered) setNotificationStatus('failed')
      })
      .catch(() => setNotificationStatus('failed'))
  }, [uid])

  if (!household || !selectedBaby || !user) return null

  const handleToggleActive = (nextActive: boolean) => {
    // Saves the time shown too: a time still waiting goes with it.
    clearTimeout(saveTimer.current)
    pendingSave.current = null
    setActive(nextActive)
    void setReminder(household.id, selectedBaby.id, medicationName, timeOfDay, nextActive)
  }

  const handleTimeChange = (nextTimeOfDay: string) => {
    setTimeOfDay(nextTimeOfDay)
    pendingSave.current = () =>
      void setReminder(household.id, selectedBaby.id, medicationName, nextTimeOfDay, active)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flushTimeSave, TIME_SAVE_DELAY_MS)
  }

  const handleEnableNotifications = async () => {
    setNotificationStatus('requesting')
    try {
      const registered = await registerPush(user.uid)
      if (registered) setNotificationStatus('enabled')
      else setNotificationStatus(Notification.permission === 'denied' ? 'blocked' : 'failed')
    } catch {
      setNotificationStatus('failed')
    }
  }

  return (
    <Modal title={`${medicationName} Reminder`} bandColorVar="--category-medication" onClose={onClose}>
      <div>
        <label>
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => handleToggleActive(event.target.checked)}
          />
          Reminder active
        </label>
      </div>
      <div>
        <span className="field-label">Reminder time</span>
        <TimeSelect label="Reminder time" value={timeOfDay} onChange={handleTimeChange} />
      </div>
      <div>
        <button
          type="button"
          onClick={() => void handleEnableNotifications()}
          disabled={notificationStatus !== 'idle' && notificationStatus !== 'failed'}
        >
          {notificationStatus === 'enabled' ? 'Notifications enabled' : 'Enable notifications'}
        </button>
        {notificationStatus === 'failed' && (
          <p role="alert">Could not enable notifications on this device/browser.</p>
        )}
        {notificationStatus === 'blocked' && (
          <p role="alert">Notifications are blocked for this app in the browser settings.</p>
        )}
      </div>
    </Modal>
  )
}
