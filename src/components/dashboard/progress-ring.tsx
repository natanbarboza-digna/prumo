type ProgressRingProps = {
  /** 0 to 100. */
  percent: number;
  /** What the ring measures, read by screen readers (e.g. "40% das ações concluídas"). */
  label: string;
  /** Diameter in pixels. */
  size?: number;
};

const STROKE = 8;

/**
 * A ring that fills up to `percent` (plan 034), in plain SVG: two circles, the
 * second drawn only along its first `percent` with stroke-dasharray. The
 * number in the middle is visible; screen readers get `label` instead.
 */
export function ProgressRing({ percent, label, size = 96 }: ProgressRingProps) {
  const center = size / 2;
  const radius = (size - STROKE) / 2;
  const length = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * length;
  return (
    <div
      role="img"
      aria-label={label}
      className="relative shrink-0"
      // The size is a prop, so it goes inline instead of a class.
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        // The stroke starts at 3 o'clock; turning the drawing starts it at the top.
        className="-rotate-90"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        {filled > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${length}`}
            className="stroke-primary"
          />
        )}
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums"
      >
        {percent}%
      </span>
    </div>
  );
}
