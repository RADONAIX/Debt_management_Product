interface ProgressRingProps {
  /** Completion 0-100. */
  progress: number;
  size?: number;
  strokeWidth?: number;
}

/**
 * Completion as a ring, with the figure in the middle.
 *
 * Drawn from 12 o'clock clockwise, so it reads the way a dial does.
 */
export function ProgressRing({ progress, size = 120, strokeWidth = 10 }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute text-xl font-semibold tabular-nums text-foreground">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
