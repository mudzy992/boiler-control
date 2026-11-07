import * as React from 'react';
import { cn } from '@/shared/lib/utils';

/** Page title block: one `h1`, optional description, optional primary action. */
export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  description,
  action,
  className,
}: PageHeaderProps): React.JSX.Element => (
  <header
    className={cn(
      'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
      className,
    )}
  >
    <div className="min-w-0 space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {action ? (
      <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
    ) : null}
  </header>
);
