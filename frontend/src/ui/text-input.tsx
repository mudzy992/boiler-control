import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, invalid, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-control-md w-full rounded-control border bg-input px-3 text-sm text-input-fg shadow-none transition-colors duration-fast',
        'border-input-border placeholder:text-input-placeholder',
        'hover:border-input-border-hover focus:border-input-border-focus focus:outline-none focus:ring-1 focus:ring-signal',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-input-invalid focus:border-input-invalid focus:ring-fault',
        className,
      )}
      {...props}
    />
  ),
);
TextInput.displayName = 'TextInput';
