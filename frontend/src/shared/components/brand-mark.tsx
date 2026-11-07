import type { JSX } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface BrandMarkProps {
  className?: string;
  iconClassName?: string;
  size?: 'sm' | 'md';
}

export const BrandMark = ({
  className,
  iconClassName,
  size = 'sm',
}: BrandMarkProps): JSX.Element => (
  <span
    className={cn(
      'inline-flex items-center justify-center rounded-md bg-brand/15 text-brand',
      size === 'sm' ? 'h-7 w-7' : 'h-10 w-10',
      className,
    )}
    aria-hidden
  >
    <Flame
      className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5', iconClassName)}
      strokeWidth={2.25}
    />
  </span>
);
