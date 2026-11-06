import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevated?: boolean;
}

const paddingClasses: Record<string, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  elevated = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={[
        'rounded-xl border border-border bg-surface shadow-sm transition-colors duration-200 dark:border-dark-border dark:bg-dark-surface-elevated',
        elevated && 'shadow-md',
        paddingClasses[padding],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
};

Card.displayName = 'Card';
