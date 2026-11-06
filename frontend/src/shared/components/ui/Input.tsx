import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const inputVariants = cva(
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: '',
        error: 'border-destructive focus-visible:ring-destructive',
      },
      inputSize: {
        default: 'h-10 px-3 py-2',
        sm: 'h-9 px-2.5 text-xs',
        lg: 'h-11 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default',
    },
  }
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
  )
);
Input.displayName = 'Input';

interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex w-full items-center gap-2', className)} {...props} />
  )
);
InputGroup.displayName = 'InputGroup';

interface InputWrapperProps extends React.HTMLAttributes<HTMLDivElement> {}

export const InputWrapper = React.forwardRef<HTMLDivElement, InputWrapperProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1', className)} {...props} />
  )
);
InputWrapper.displayName = 'InputWrapper';

interface FieldErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const FieldError = React.forwardRef<HTMLParagraphElement, FieldErrorProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-destructive', className)} {...props} />
  )
);
FieldError.displayName = 'FieldError';


