import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useReminder } from '../hooks/useReminder'
import { requestNotificationToken } from '../lib/messaging'
import { saveFcmToken } from '../repositories/fcmTokens'
import { setReminder } from '../repositories/reminders'
import { Modal } from './Modal'

const DEFAULT_TIME_OF_DAY = '09:00'

type NotificationStatus = 'idle' | 'requesting' | 'enabled' | 'denied'

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
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>('idle')

  useEffect(() => {
    if (reminder) {
      setTimeOfDay(reminder.timeOfDay)
      setActive(reminder.active)
    }
  }, [reminder])

  if (!household || !selectedBaby || !user) return null

  const handleToggleActive = (nextActive: boolean) => {
    setActive(nextActive)
    void setReminder(household.id, selectedBaby.id, medicationName, timeOfDay, nextActive)
  }

  const handleTimeChange = (nextTimeOfDay: string) => {
    setTimeOfDay(nextTimeOfDay)
    void setReminder(household.id, selectedBaby.id, medicationName, nextTimeOfDay, active)
  }

  const handleEnableNotifications = async () => {
    setNotificationStatus('requesting')
    const token = await requestNotificationToken()
    if (!token) {
      setNotificationStatus('denied')
      return
    }
    await saveFcmToken(user.uid, token)
    setNotificationStatus('enabled')
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
        <label htmlFor="reminder-time">Reminder time</label>
        <input
          id="reminder-time"
          type="time"
          value={timeOfDay}
          onChange={(event) => handleTimeChange(event.target.value)}
        />
      </div>
      <div>
        <button
          type="button"
          onClick={() => void handleEnableNotifications()}
          disabled={notificationStatus === 'requesting' || notificationStatus === 'enabled'}
        >
          {notificationStatus === 'enabled' ? 'Notifications enabled' : 'Enable notifications'}
        </button>
        {notificationStatus === 'denied' && (
          <p role="alert">
            Notifications denied or unavailable on this device/browser.
          </p>
        )}
      </div>
    </Modal>
  )
}
