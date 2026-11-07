import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type StackGap = 'page' | 'section' | 'field';

const gapClass: Record<StackGap, string> = {
  page: 'space-y-6',
  section: 'space-y-4',
  field: 'space-y-3',
};

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: StackGap;
}

export const Stack = ({
  gap = 'page',
  className,
  ...props
}: StackProps) => (
  <div className={cn(gapClass[gap], className)} {...props} />
);
