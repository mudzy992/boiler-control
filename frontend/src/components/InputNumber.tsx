import * as React from 'react';
import { Field, NumberInput, fieldAria } from '@/ui';

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

export const InputNumber = React.forwardRef<HTMLInputElement, InputNumberProps>(
  (
    {
      value,
      onChange,
      min,
      max,
      step = 1,
      label,
      error,
      helperText,
      className = '',
      addonAfter,
      placeholder,
      id,
      disabled,
      name,
    },
    ref,
  ) => {
    const inputId = id ?? name ?? 'number-input';
    const control = (
      <div className="relative">
        <NumberInput
          ref={ref}
          id={inputId}
          name={name}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          invalid={Boolean(error)}
          className={addonAfter ? `pr-10 ${className}` : className}
          value={value ?? ''}
          onValueChange={(next) => onChange?.(next ?? null)}
          {...fieldAria(inputId, { hint: helperText, error })}
        />
        {addonAfter ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-dim">
            {addonAfter}
          </span>
        ) : null}
      </div>
    );
    if (!label) {
      return control;
    }
    return (
      <Field id={inputId} label={label} hint={helperText} error={error}>
        {control}
      </Field>
    );
  },
);
InputNumber.displayName = 'InputNumber';
