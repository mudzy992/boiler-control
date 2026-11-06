import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  children,
  icon,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variants: Record<string, string> = {
    primary:
      'bg-brand text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm',
    secondary:
      'bg-surface border border-border text-text-primary hover:bg-surface-muted dark:border-dark-border dark:bg-dark-surface-elevated dark:text-dark-text-primary',
    ghost:
      'bg-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary dark:hover:bg-dark-surface-muted',
    danger:
      'bg-error text-white hover:bg-red-600 active:bg-red-700 shadow-sm',
    success:
      'bg-success text-white hover:bg-green-600 active:bg-green-700 shadow-sm',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={[
        base,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      ].join(' ')}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="sr-only">Učitavanje...</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

Button.displayName = 'Button';
