import type { ReactNode } from 'react';
import { cn } from './cn';

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export const Field = ({
  id,
  label,
  hint,
  error,
  children,
  className,
}: FieldProps) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-dim">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-fault" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export const fieldAria = (
  id: string,
  opts: { hint?: string; error?: string },
): { 'aria-invalid'?: boolean; 'aria-describedby'?: string } => {
  const parts = [
    opts.error ? `${id}-error` : null,
    opts.hint && !opts.error ? `${id}-hint` : null,
  ].filter(Boolean);
  return {
    'aria-invalid': opts.error ? true : undefined,
    'aria-describedby': parts.length ? parts.join(' ') : undefined,
  };
};
