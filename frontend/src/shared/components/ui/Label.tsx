import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@/ui';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium text-ink', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
