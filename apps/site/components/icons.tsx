// The page's few icons, inline so nothing is fetched. All are decorative:
// the text next to them carries the meaning.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

export const ArrowIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export const CopyIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 8.5l3.2 3.2L13 5" />
  </svg>
);

export const PauseIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M5.5 3.5v9M10.5 3.5v9" />
  </svg>
);

export const PlayIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M5 3.5l7.5 4.5L5 12.5z" />
  </svg>
);

export const ReplayIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.1" />
    <path d="M2.5 2.5v3h3" />
  </svg>
);

export const StepIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 3.5l6 4.5-6 4.5zM12 3.5v9" />
  </svg>
);

export const ExternalIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M6.5 3.5h-3v9h9v-3M9.5 2.5h4v4M13.5 2.5l-6 6" />
  </svg>
);

export const GitHubIcon = (props: IconProps) => (
  <svg {...base} stroke="none" fill="currentColor" {...props}>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

/** The interim Lumenstat mark: a lilac rounded square with three rising bars. */
export const Mark = ({ size = 24, ...props }: IconProps & { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable={false} {...props}>
    <rect width="32" height="32" rx="8" fill="#6E56CF" />
    <rect x="8" y="17" width="4" height="7" rx="1" fill="#fff" />
    <rect x="14" y="12.5" width="4" height="11.5" rx="1" fill="#fff" />
    <rect x="20" y="8" width="4" height="16" rx="1" fill="#fff" />
  </svg>
);
