import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

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

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-control-sm px-3 text-xs',
  md: 'h-control-md px-4 text-sm',
  lg: 'h-control-lg px-5 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingLabel?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingLabel,
      disabled,
      type = 'button',
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading || undefined}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control border font-medium shadow-none transition-colors duration-fast',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  ),
);
Button.displayName = 'Button';
