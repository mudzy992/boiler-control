import { Flame } from 'lucide-react';
import { cn } from './cn';

export interface LogoMarkProps {
  size?: 'sm' | 'md';
  className?: string;
}

export const LogoMark = ({ size = 'sm', className }: LogoMarkProps) => (
  <span
    className={cn(
      'inline-flex items-center justify-center rounded-control bg-signal/15 text-signal',
      size === 'sm' ? 'h-7 w-7' : 'h-10 w-10',
      className,
    )}
    aria-hidden
  >
    <Flame className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
  </span>
);
