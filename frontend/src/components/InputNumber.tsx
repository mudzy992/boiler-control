import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface InputNumberProps {
  value?: number | null;
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number | string;
  precision?: number;
  label?: string;
  error?: string;
  helperText?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  addonAfter?: React.ReactNode;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  name?: string;
}

const sizeClasses: Record<NonNullable<InputNumberProps['size']>, string> = {
  sm: 'h-9 px-2.5 text-xs',
  md: 'h-10 px-3 text-sm',
  lg: 'h-11 px-4 text-base',
};

const roundToPrecision = (value: number, precision?: number): number => {
  if (typeof precision !== 'number') {
    return value;
  }
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const toDisplay = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return String(value);
};

export const InputNumber = React.forwardRef<HTMLInputElement, InputNumberProps>(
  (
    {
      value,
      onChange,
      min,
      max,
      step: _step = 1,
      precision,
      label,
      error,
      helperText,
      className = '',
      size = 'md',
      addonAfter,
      placeholder,
      id,
      disabled,
      name,
    },
    ref,
  ) => {
    const hasError = Boolean(error);
    const inputId = id ?? name;
    const [draft, setDraft] = React.useState(() => toDisplay(value));
    const [isFocused, setIsFocused] = React.useState(false);

    React.useEffect(() => {
      if (!isFocused) {
        setDraft(toDisplay(value));
      }
    }, [value, isFocused]);

    const emitParsed = (raw: string): void => {
      if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
        onChange?.(null);
        return;
      }
      const parsed = Number(raw);
      if (Number.isNaN(parsed)) {
        return;
      }
      onChange?.(roundToPrecision(parsed, precision));
    };

    const handleBlur = (): void => {
      setIsFocused(false);
      if (draft === '' || draft === '-' || draft === '.' || draft === '-.') {
        setDraft('');
        onChange?.(null);
        return;
      }
      let parsed = Number(draft);
      if (Number.isNaN(parsed)) {
        setDraft(toDisplay(value));
        return;
      }
      if (typeof min === 'number' && parsed < min) {
        parsed = min;
      }
      if (typeof max === 'number' && parsed > max) {
        parsed = max;
      }
      const next = roundToPrecision(parsed, precision);
      setDraft(String(next));
      onChange?.(next);
    };

    return (
      <div className="space-y-1">
        {label ? (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        ) : null}
        <div className="relative flex w-full items-center">
          <input
            ref={ref}
            id={inputId}
            name={name}
            type="text"
            inputMode="decimal"
            value={draft}
            onFocus={() => setIsFocused(true)}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw !== '' && !/^-?\d*\.?\d*$/.test(raw)) {
                return;
              }
              setDraft(raw);
              emitParsed(raw);
            }}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-describedby={
              hasError && inputId
                ? `${inputId}-error`
                : helperText && inputId
                  ? `${inputId}-helper`
                  : undefined
            }
            className={cn(
              'flex w-full rounded-md border border-input bg-background text-foreground ring-offset-background',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              hasError && 'border-destructive focus-visible:ring-destructive',
              sizeClasses[size],
              addonAfter ? 'pr-10' : undefined,
              className,
            )}
          />
          {addonAfter ? (
            <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground">
              {addonAfter}
            </span>
          ) : null}
        </div>
        {error ? (
          <p
            id={inputId ? `${inputId}-error` : undefined}
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {helperText && !error ? (
          <p
            id={inputId ? `${inputId}-helper` : undefined}
            className="text-sm text-muted-foreground"
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

InputNumber.displayName = 'InputNumber';
