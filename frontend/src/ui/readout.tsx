import type { ReactNode } from 'react';
import { cn } from './cn';

export interface ReadoutProps {
  label: string;
  value: ReactNode;
  unit?: string;
  className?: string;
  valueClassName?: string;
}

export const Readout = ({
  label,
  value,
  unit,
  className,
  valueClassName,
}: ReadoutProps) => (
  <div className={cn('min-w-0', className)}>
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
      {label}
    </p>
    <p
      className={cn(
        'mt-1 font-mono text-kpi font-semibold tabular-nums text-signal',
        valueClassName,
      )}
    >
      {value}
      {unit ? (
        <span className="ml-1 text-lg text-ink-muted">{unit}</span>
      ) : null}
    </p>
  </div>
);
