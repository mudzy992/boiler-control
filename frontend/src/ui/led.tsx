import { cn } from './cn';

export type LedState = 'on' | 'off' | 'fault';

const stateClass: Record<LedState, string> = {
  on: 'bg-ok animate-status-pulse',
  off: 'bg-ink-dim/50',
  fault: 'bg-fault animate-status-pulse',
};

export interface LedProps {
  state?: LedState;
  className?: string;
}

export const Led = ({ state = 'off', className }: LedProps) => (
  <span
    className={cn('mt-1.5 h-3 w-3 shrink-0 rounded-full', stateClass[state], className)}
    aria-hidden
  />
);
