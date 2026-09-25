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
      <path d="M13.5 3.5a8.5 8.5 0 1 0 7 12.5 7 7 0 0 1-7-12.5Z" />
      <path d="m17.5 3.5.9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2.1-.3.9-1.9Z" />
    </Icon>
  )
}

export function FeedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <g transform="rotate(-35 12 12)">
        <path d="M10.5 2.5h3v2h-3z" />
        <path d="M9.5 4.5h5l1 2.5h-7l1-2.5Z" />
        <path d="M8.5 7h7v11.5a2.5 2.5 0 0 1-2.5 2.5h-2a2.5 2.5 0 0 1-2.5-2.5V7Z" />
        <path d="M8.5 12h7" />
      </g>
    </Icon>
  )
}

export function DiaperIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 6h18v3.5c0 5.5-4 9.5-9 9.5s-9-4-9-9.5V6Z" />
      <path d="M3 9h18" />
      <path d="M8 18.5c.4-3.5 1.8-5.5 4-5.5s3.6 2 4 5.5" />
      <path d="M5 6v3M19 6v3" />
    </Icon>
  )
}

export function MedicationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="11" height="3.5" rx="1" />
      <rect x="3.5" y="6.5" width="12" height="14" rx="2" />
      <path d="M9.5 10.5v6M6.5 13.5h6" />
      <path d="M19 4v13a1.5 1.5 0 0 1-3 0" />
      <circle cx="19" cy="18.5" r="1.8" />
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
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M7.5 9.5a4.5 4.5 0 0 1 9 0Z" />
      <path d="m12 9.5 1.5-2.5" />
    </Icon>
  )
}

export function RulerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="6" height="18" rx="1" />
      <path d="M4 7h3M4 10.5h2M4 14h3M4 17.5h2" />
      <path d="M17 4v16M14.5 6.5 17 4l2.5 2.5M14.5 17.5 17 20l2.5-2.5" />
    </Icon>
  )
}

export function HeadCircumferenceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="11" width="19" height="6" rx="1" />
      <path d="M5.5 11v2.5M8.5 11v1.5M11.5 11v2.5M14.5 11v1.5M17.5 11v2.5" />
      <path d="M4 7h16M6.5 4.5 4 7l2.5 2.5M17.5 4.5 20 7l-2.5 2.5" />
    </Icon>
  )
}

export function SlidersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h13M21 18h-1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="7" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
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

export function BibIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M8 3.5a4 4 0 0 0 8 0" />
      <path d="M8 3.5C5 4.5 4 7.5 4 11a8 8 0 0 0 16 0c0-3.5-1-6.5-4-7.5" />
      <path d="M9.5 9a2.5 2.5 0 0 0 5 0" />
    </Icon>
  )
}

export function BottleSizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 2.5h4v2.5h-4z" />
      <path d="M9 5h6l1.5 3v11a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 7.5 19V8L9 5Z" />
      <path d="M10 12h3M10 15h4M10 18h3" />
    </Icon>
  )
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 17a6 6 0 0 1 12 0Z" />
      <path d="M12 4v3M4.5 9.5l2 1.5M19.5 9.5l-2 1.5M2.5 17h2M19.5 17h2" />
    </Icon>
  )
}

export function StarsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m7 3 1.2 2.6 2.8.3-2.1 1.9.6 2.8L7 9.2 4.5 10.6l.6-2.8L3 5.9l2.8-.3L7 3Z" />
      <path d="m17 7 1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3L17 7Z" />
      <path d="m9 13 1.2 2.6 2.8.3-2.1 1.9.6 2.8L9 19.2l-2.5 1.4.6-2.8L5 15.9l2.8-.3L9 13Z" />
    </Icon>
  )
}

export function ZzzIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M13 4h7l-7 8h7" />
      <path d="M4 10h5l-5 5h5" />
      <path d="M9 17h4l-4 4h4" />
    </Icon>
  )
}

export function HourglassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" />
    </Icon>
  )
}

export function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" />
    </Icon>
  )
}

export function CameraIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 7.5h3l1.5-2h7l1.5 2h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M12 11.5v3M10.5 13h3" />
    </Icon>
  )
}

export function BathIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2Z" />
      <path d="M6 12V5.5a2 2 0 0 1 3.7-1" />
      <path d="M7 19l-1 2M17 19l1 2" />
      <circle cx="13" cy="7" r="1.2" />
      <circle cx="16.5" cy="5" r="1" />
      <circle cx="16" cy="9" r="0.8" />
    </Icon>
  )
}

export function VitaminIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="9.5" y="2.5" width="5" height="4" rx="1.5" />
      <path d="M10.5 6.5h3v3l1.5 2V19a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-7.5l1.5-2v-3Z" />
      <path d="M12 13.5c-1 1.3-1.5 2-1.5 2.8a1.5 1.5 0 0 0 3 0c0-.8-.5-1.5-1.5-2.8Z" />
    </Icon>
  )
}

export function RoutineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9.5h16M8.5 3v4M15.5 3v4" />
      <path d="m9 14.5 2 2 4-4" />
    </Icon>
  )
}
