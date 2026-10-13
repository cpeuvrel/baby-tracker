import { describe, expect, it } from 'vitest'
import * as functions from './index'

describe('deployed functions', () => {
  // `firebase deploy --only functions --force` deletes, without asking, any
  // deployed function the build no longer exports: a lost export must fail here.
  it('exports exactly the deployed functions', () => {
    expect(Object.keys(functions).sort()).toEqual([
      'askVaccinePurchase',
      'checkMedicationReminders',
      'onPediatricianVisitWritten',
      'onSleepEntryWritten',
      'remindVaccineDay',
      'tickSleepTimerNotifications',
    ])
  })
})
