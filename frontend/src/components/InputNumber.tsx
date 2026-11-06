import React from 'react';
import { InputNumber as AntdInputNumber } from 'antd';
import type { InputNumberProps as AntdInputNumberProps } from 'antd';

export interface InputNumberProps
  extends Omit<AntdInputNumberProps, 'className' | 'size'> {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  error?: string;
  helperText?: string;
}

const sizeClasses: Record<string, string> = {
  sm: 'px-2 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
};

export const InputNumber: React.FC<InputNumberProps> = ({
  className = '',
  size = 'md',
  label,
  error,
  helperText,
  ...props
}) => {
  const hasError = Boolean(error);

  return (
    <div className="space-y-1">
      {label && (
        <label
          className="block text-sm font-semibold text-text-secondary dark:text-dark-text-secondary"
        >
          {label}
        </label>
      )}
      <AntdInputNumber
        {...props}
        className={[
          'block w-full rounded-lg border border-border px-3 py-2 text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand',
          'bg-surface text-text-primary placeholder:text-text-tertiary',
          'border-border dark:border-dark-border dark:bg-dark-surface-elevated dark:text-dark-text-primary',
          hasError
            ? 'border-error focus-visible:ring-error focus-visible:border-error'
            : '',
          sizeClasses[size],
          className,
        ].join(' ')}
      />
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

InputNumber.displayName = 'InputNumber';
