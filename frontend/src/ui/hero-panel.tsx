import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export const HeroPanel = forwardRef<
  HTMLElement,
  HTMLAttributes<HTMLElement>
>(({ className, children, ...props }, ref) => (
  <section
    ref={ref}
    className={cn(
      'relative overflow-hidden rounded-panel border border-hero-border bg-hero p-4 sm:p-5',
      'before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-2 before:w-2 before:border-l before:border-t before:border-signal',
      'after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-2 after:w-2 after:border-b after:border-r after:border-signal',
      className,
    )}
    {...props}
  >
    {children}
  </section>
));
HeroPanel.displayName = 'HeroPanel';
