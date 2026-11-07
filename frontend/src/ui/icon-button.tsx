import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import type { ButtonVariant } from './button';

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'border-btn-primary-border bg-btn-primary text-btn-primary-fg hover:bg-btn-primary-hover',
  secondary:
    'border-btn-secondary-border bg-btn-secondary text-btn-secondary-fg hover:bg-btn-secondary-hover',
  ghost:
    'border-transparent bg-transparent text-btn-ghost-fg hover:bg-btn-ghost-hover',
  danger:
    'border-btn-danger-border bg-btn-danger text-btn-danger-fg hover:bg-btn-danger-hover',
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  'aria-label': string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = 'ghost',
      type = 'button',
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex h-control-md w-control-md items-center justify-center rounded-control border shadow-none transition-colors duration-fast',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = 'IconButton';
