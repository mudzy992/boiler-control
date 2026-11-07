import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  invalid?: boolean;
  onValueChange?: (value: number | undefined) => void;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, invalid, onValueChange, onBlur, ...props }, ref) => (
    <input
      ref={ref}
      type="number"
      className={cn(
        'h-control-md w-full rounded-control border bg-input px-3 font-mono text-sm tabular-nums text-input-fg shadow-none transition-colors duration-fast',
        'border-input-border placeholder:text-input-placeholder',
        'hover:border-input-border-hover focus:border-input-border-focus focus:outline-none focus:ring-1 focus:ring-signal',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-input-invalid focus:border-input-invalid focus:ring-fault',
        className,
      )}
      onChange={(event) => {
        if (!onValueChange) {
          return;
        }
        const raw = event.target.value;
        if (raw === '') {
          onValueChange(undefined);
          return;
        }
        const next = Number(raw);
        onValueChange(Number.isFinite(next) ? next : undefined);
      }}
      onBlur={onBlur}
      {...props}
    />
  ),
);
NumberInput.displayName = 'NumberInput';
