import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeTone = 'ok' | 'warn' | 'fault' | 'info' | 'muted';

const toneClass: Record<BadgeTone, string> = {
  ok: 'border-ok/40 bg-ok/10 text-ok',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  fault: 'border-fault/40 bg-fault/10 text-fault',
  info: 'border-info/40 bg-info/10 text-info',
  muted: 'border-line bg-raised text-ink-muted',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export const Badge = ({
  className,
  tone = 'muted',
  ...props
}: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center rounded-control border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide',
      toneClass[tone],
      className,
    )}
    {...props}
  />
);
