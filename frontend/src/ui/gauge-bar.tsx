import { cn } from './cn';

export interface GaugeBarProps {
  ratio: number;
  label: string;
  detail?: string;
  overtime?: boolean;
  className?: string;
}

export const GaugeBar = ({
  ratio,
  label,
  detail,
  overtime = false,
  className,
}: GaugeBarProps) => {
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-ink">{label}</span>
        {detail ? (
          <span
            className={cn(
              'font-semibold',
              overtime ? 'text-fault' : 'text-ink-muted',
            )}
          >
            {detail}
          </span>
        ) : null}
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-control bg-raised"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        <div
          className={cn(
            'h-full rounded-control transition-[width] duration-fast',
            overtime ? 'bg-fault' : 'bg-signal',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
