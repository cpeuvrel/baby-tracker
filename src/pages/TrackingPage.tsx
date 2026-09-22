import { BabySelector } from '../components/BabySelector'
import { DailyTimeline } from '../components/DailyTimeline'
import { DiaperLogCard } from '../components/DiaperLogCard'
import { FeedingCard } from '../components/FeedingCard'
import { SleepTimerCard } from '../components/SleepTimerCard'

export function TrackingPage() {
  return (
    <div>
      <BabySelector />
      <SleepTimerCard />
      <FeedingCard />
      <DiaperLogCard />
      <DailyTimeline />
    </div>
  )
}
