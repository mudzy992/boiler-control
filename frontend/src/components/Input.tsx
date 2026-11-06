import React from 'react';

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  rows?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  placeholder,
  rows,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const hasError = Boolean(error);
  const isTextarea = rows != null;
  const { onChange, ...restProps } = props;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange?.(e as React.ChangeEvent<HTMLInputElement>);
  };

  const baseClasses = [
    'block w-full rounded-lg border border-border px-3 py-2 text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand',
    'bg-surface text-text-primary placeholder:text-text-tertiary',
    'border-border dark:border-dark-border dark:bg-dark-surface-elevated dark:text-dark-text-primary',
    hasError
      ? 'border-error focus-visible:ring-error focus-visible:border-error'
      : '',
    className,
  ].join(' ');

  return (
    <div className={['space-y-1', className].filter(Boolean).join(' ')}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-text-secondary dark:text-dark-text-secondary"
        >
          {label}
        </label>
      )}
      {isTextarea ? (
        <textarea
          id={inputId}
          rows={rows}
          placeholder={placeholder}
          className={baseClasses}
          onChange={handleChange}
          {...(restProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={inputId}
          placeholder={placeholder}
          className={baseClasses}
          onChange={handleChange}
          {...restProps}
        />
      )}
      {error && (
        <p className="text-sm text-error dark:text-dark-error">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-text-tertiary dark:text-dark-text-tertiary">
          {helperText}
        </p>
      )}
    </div>
  );
};

Input.displayName = 'Input';
