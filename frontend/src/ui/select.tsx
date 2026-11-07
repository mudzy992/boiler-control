import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-control-md w-full rounded-control border bg-input px-3 text-sm text-input-fg shadow-none transition-colors duration-fast',
        'border-input-border hover:border-input-border-hover',
        'focus:border-input-border-focus focus:outline-none focus:ring-1 focus:ring-signal',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-input-invalid focus:border-input-invalid focus:ring-fault',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
