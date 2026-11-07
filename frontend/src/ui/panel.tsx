import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative rounded-panel border border-panel-border bg-panel text-ink',
        className,
      )}
      {...props}
    />
  ),
);
Panel.displayName = 'Panel';

export const PanelHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-between gap-3 border-b border-panel-border bg-panel-header px-4 py-2.5',
      className,
    )}
    {...props}
  />
));
PanelHeader.displayName = 'PanelHeader';

export const PanelTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted',
      className,
    )}
    {...props}
  />
));
PanelTitle.displayName = 'PanelTitle';

export const PanelBody = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-4', className)} {...props} />
));
PanelBody.displayName = 'PanelBody';

export const PanelFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-wrap items-center gap-2 border-t border-panel-border px-4 py-3',
      className,
    )}
    {...props}
  />
));
PanelFooter.displayName = 'PanelFooter';
