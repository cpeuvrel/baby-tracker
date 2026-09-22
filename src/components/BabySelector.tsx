import { useHousehold } from '../contexts/HouseholdContext'

export function BabySelector() {
  const { babies, selectedBaby, selectBaby } = useHousehold()

  if (babies.length === 0) return null

  return (
    <div>
      <label htmlFor="baby-selector">Bébé</label>
      <select
        id="baby-selector"
        value={selectedBaby?.id ?? ''}
        onChange={(event) => selectBaby(event.target.value)}
      >
        {babies.map((baby) => (
          <option key={baby.id} value={baby.id}>
            {baby.name}
          </option>
        ))}
      </select>
    </div>
  )
}
