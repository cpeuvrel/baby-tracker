import type { SVGProps } from 'react'

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export function SleepIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M15.5 4.5a7.5 7.5 0 1 0 6 8.9 6 6 0 0 1-6-8.9Z" />
      <path d="M19 3.5v2M18 4.5h2" />
    </Icon>
  )
}

export function FeedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 3h4l1 2.2-1.4 1.6H9.4L8 5.2 9 3Z" />
      <path d="M8.5 6.5h5l1 3v9a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-9l1-3Z" />
      <path d="M7.5 12h7" />
    </Icon>
  )
}

export function DiaperIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 6h16l-1.5 6.5a6.5 6.5 0 0 1-13 0L4 6Z" />
      <path d="M8 12.5a4 4 0 0 0 8 0" />
    </Icon>
  )
}

export function MedicationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3c-3 3.5-6 7-6 10.5a6 6 0 0 0 12 0C18 10 15 6.5 12 3Z" />
      <path d="M8.5 13.5a3.5 3.5 0 0 0 3.5 3.5" />
    </Icon>
  )
}

export function GrowthIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 20V9M9 20v-6M14 20V6M19 20v-9" />
      <path d="M3 20h18" />
    </Icon>
  )
}

export function BabyAvatarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="13" r="7" />
      <path d="M9.5 12.5c0 1.5 1 2.5 2.5 2.5s2.5-1 2.5-2.5" />
      <path d="M9 10h.01M15 10h.01" />
      <path d="M11 4.5c0-1 .8-2 2-2" />
    </Icon>
  )
}

export function TimerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" />
      <path d="M10 2h4M12 2v2" />
    </Icon>
  )
}

export function ScaleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 10a4 4 0 0 0 8 0" />
    </Icon>
  )
}

export function RulerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3v15M9 6h3M9 9h3M9 12h3M9 15h3" />
      <path d="M8 18l4 3 4-3" />
    </Icon>
  )
}

export function HeadCircumferenceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5V3M12 21v-2M19 12h2M3 12h2" />
    </Icon>
  )
}

export function ListViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </Icon>
  )
}
