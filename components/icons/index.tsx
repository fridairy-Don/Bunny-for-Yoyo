// Small, reusable stroke-based SVG icons. All follow the same 24x24 viewBox
// and inherit currentColor so they blend in with whatever button is hosting
// them. Keep these simple — if an icon needs animation or a fill variant,
// inline it near the component that uses it.

type IconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  ariaHidden?: boolean;
};

function baseProps({ size = 14, strokeWidth = 1.8, className, ariaHidden = true }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": ariaHidden,
  };
}

export function MusicNoteIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function BookmarkIcon({ filled = false, ...rest }: IconProps & { filled?: boolean }) {
  return (
    <svg {...baseProps(rest)} fill={filled ? "currentColor" : "none"}>
      <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function MoonIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function CloseIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps({ ...props, strokeWidth: props.strokeWidth ?? 2 })}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function PlusIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function VolumeIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps({ ...props, strokeWidth: props.strokeWidth ?? 1.7 })}>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a4 4 0 0 1 0 7" />
    </svg>
  );
}

export function PrevIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M19 20 9 12l10-8zM5 4v16" />
    </svg>
  );
}

export function NextIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M5 4l10 8-10 8zM19 4v16" />
    </svg>
  );
}

export function PlayPauseIcon({ playing, ...rest }: IconProps & { playing: boolean }) {
  return (
    <svg
      width={rest.size ?? 14}
      height={rest.size ?? 14}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      {playing ? (
        <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
      ) : (
        <path d="M6 4v16l14-8z" />
      )}
    </svg>
  );
}

export function RepeatOneIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      <text
        x="12"
        y="14"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        1
      </text>
    </svg>
  );
}

export function ShuffleIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M16 3h5v5" />
      <path d="M4 20L21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

export function RepeatAllIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function MicIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps({ ...props, strokeWidth: props.strokeWidth ?? 1.6 })}>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
