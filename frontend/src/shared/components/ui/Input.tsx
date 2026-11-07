import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const inputVariants = cva(
  'flex w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: '',
        error: 'border-destructive focus-visible:ring-destructive',
      },
      inputSize: {
        default: 'h-9 py-2',
        sm: 'h-8 px-2.5 text-xs',
        lg: 'h-10 px-3.5 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default',
    },
  },
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, ...props }, ref) => (
    <input
      type={type}
      className={cn(inputVariants({ variant, inputSize }), className)}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const InputGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex w-full items-center gap-2', className)} {...props} />
  ),
);
InputGroup.displayName = 'InputGroup';

export const InputWrapper = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5', className)} {...props} />
  ),
);
InputWrapper.displayName = 'InputWrapper';

export const FieldError = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-destructive', className)} role="alert" {...props} />
));
FieldError.displayName = 'FieldError';
