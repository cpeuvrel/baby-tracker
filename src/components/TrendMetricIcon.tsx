import type { ReactNode } from 'react'
import type { TrendMetricId } from '../lib/trendMetrics'
import {
  BibIcon,
  BottleSizeIcon,
  ClockIcon,
  DiaperIcon,
  FeedIcon,
  HourglassIcon,
  SleepIcon,
  StarsIcon,
  SunIcon,
  TimerIcon,
  ZzzIcon,
} from './icons'

const METRIC_ICONS: Record<TrendMetricId, ReactNode> = {
  feedSessions: <BibIcon />,
  feedVolume: <FeedIcon />,
  feedAvgVolume: <BottleSizeIcon />,
  feedInterval: <ClockIcon />,
  diaperCount: <DiaperIcon />,
  diaperDay: <SunIcon />,
  diaperNight: <StarsIcon />,
  sleepTotal: <SleepIcon />,
  sleepDay: <SunIcon />,
  sleepNight: <StarsIcon />,
  sleepLongest: <TimerIcon />,
  napCount: <ZzzIcon />,
  napLength: <HourglassIcon />,
  wakeWindow: <ClockIcon />,
}

/** Illustration of a Trends metric: its line icon over a blob of the category color. */
export function TrendMetricIcon({ id, colorVar }: { id: TrendMetricId; colorVar: string }) {
  return (
    <span className="trend-metric-icon" style={{ ['--trend-color' as string]: `var(${colorVar})` }}>
      {METRIC_ICONS[id]}
    </span>
  )
}
