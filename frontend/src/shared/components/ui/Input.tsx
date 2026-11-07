import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Field, TextInput as UiTextInput, fieldAria } from '@/ui';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, prefix, suffix, ...props }, ref) => {
    const inputId = id ?? props.name ?? 'input';
    const control = (
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim">
            {prefix}
          </span>
        ) : null}
        <UiTextInput
          ref={ref}
          id={inputId}
          invalid={Boolean(error)}
          className={[prefix ? 'pl-9' : '', suffix ? 'pr-9' : '', className]
            .filter(Boolean)
            .join(' ')}
          {...fieldAria(inputId, { hint, error })}
          {...props}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim">
            {suffix}
          </span>
        ) : null}
      </div>
    );
    if (!label) {
      return control;
    }
    return (
      <Field id={inputId} label={label} hint={hint} error={error}>
        {control}
      </Field>
    );
  },
);
Input.displayName = 'Input';

export const InputWrapper = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <div className={className}>{children}</div>;

export const FieldError = ({
  children,
  id,
}: {
  children?: ReactNode;
  id?: string;
}) =>
  children ? (
    <p id={id} className="text-xs text-fault" role="alert">
      {children}
    </p>
  ) : null;

export const InputGroup = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <div className={className}>{children}</div>;
