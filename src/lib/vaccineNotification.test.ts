import { describe, expect, it } from 'vitest'
import {
  VACCINE_BOUGHT_ACTION,
  VACCINE_DAY_PUSH,
  VACCINE_PURCHASE_CLOSE_PUSH,
  VACCINE_PURCHASE_PUSH,
  readVaccinePurchaseClose,
  readVaccinePush,
  vaccineNotification,
  type VaccineNotificationData,
} from './vaccineNotification'

const push = {
  babyId: 'b1',
  babyName: 'Léo',
  visitId: 'v1',
  visitDate: '2026-10-13',
}

describe('vaccine notifications', () => {
  it('reads only complete vaccine pushes', () => {
    expect(readVaccinePush({ type: VACCINE_PURCHASE_PUSH, ...push })).toEqual({ type: VACCINE_PURCHASE_PUSH, ...push })
    expect(readVaccinePush({ type: 'sleep-timer', ...push })).toBeNull()
    expect(readVaccinePush({ type: VACCINE_DAY_PUSH, babyId: 'b1' })).toBeNull()
    expect(readVaccinePush(undefined)).toBeNull()
  })

  it('asks whether the vaccine was bought, with yes/no actions', () => {
    const { title, options } = vaccineNotification({ type: VACCINE_PURCHASE_PUSH, ...push })

    expect(title).toBe('Vaccine bought?')
    expect(options.body).toBe("Léo's visit on Tue, Oct 13, 2026: have you bought the vaccine?")
    expect((options as { actions: { action: string }[] }).actions.map((a) => a.action)).toContain(
      VACCINE_BOUGHT_ACTION,
    )
    expect(options.tag).toBe('vaccine-purchase-v1')
    expect(options.data as VaccineNotificationData).toEqual({
      url: '/account/pediatrician/visits/v1?baby=b1',
      boughtUrl: '/account/pediatrician/visits/v1?baby=b1&vaccineBought=yes',
    })
  })

  it('reminds to take the vaccine on the day', () => {
    const { title, options } = vaccineNotification({ type: VACCINE_DAY_PUSH, ...push })

    expect(title).toBe('Vaccine today')
    expect(options.body).toBe("Don't forget to take Léo's vaccine to the pediatrician.")
    expect('actions' in options).toBe(false)
  })
  it('reads the push closing a visit’s question', () => {
    expect(readVaccinePurchaseClose({ type: VACCINE_PURCHASE_CLOSE_PUSH, visitId: 'v1' })).toBe('v1')
    expect(readVaccinePurchaseClose({ type: VACCINE_PURCHASE_PUSH, visitId: 'v1' })).toBeNull()
    expect(readVaccinePush({ type: VACCINE_PURCHASE_CLOSE_PUSH, ...push })).toBeNull()
  })

  it('keeps the day reminder apart from the question it closes', () => {
    expect(vaccineNotification({ type: VACCINE_DAY_PUSH, ...push }).options.tag).toBe('vaccine-day-v1')
  })
})
