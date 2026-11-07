import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[88px] w-full rounded-control border bg-input px-3 py-2 text-sm text-input-fg shadow-none transition-colors duration-fast',
        'border-input-border placeholder:text-input-placeholder',
        'hover:border-input-border-hover focus:border-input-border-focus focus:outline-none focus:ring-1 focus:ring-signal',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-input-invalid focus:border-input-invalid focus:ring-fault',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
