import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-control border transition-colors duration-fast',
        checked
          ? 'border-signal bg-signal'
          : 'border-line-strong bg-raised',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block h-3.5 w-3.5 rounded-control bg-ink transition-transform duration-fast',
          checked ? 'translate-x-[18px] bg-btn-primary-fg' : 'translate-x-0.5',
        )}
        aria-hidden
      />
    </button>
  ),
);
Switch.displayName = 'Switch';
