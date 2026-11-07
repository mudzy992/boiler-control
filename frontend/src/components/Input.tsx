import * as React from 'react';
import { Label } from '@/shared/components/ui/Label';
import { Input as SharedInput } from '@/shared/components/ui/Input';
import { cn } from '@/ui';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={cn('mb-4 space-y-1', className)}>
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <SharedInput
        id={inputId}
        error={error}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error ? <p className="text-sm text-fault">{error}</p> : null}
      {helperText && !error ? (
        <p className="text-sm text-ink-muted">{helperText}</p>
      ) : null}
    </div>
  );
};

Input.displayName = 'Input';
