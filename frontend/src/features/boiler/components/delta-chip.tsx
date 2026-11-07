import type { JSX } from 'react';

interface DeltaChipProps {
  delta: number;
}

export const DeltaChip = ({ delta }: DeltaChipProps): JSX.Element => {
  const abs = Math.abs(delta);
  const config =
    abs <= 2
      ? {
          label: 'OK',
          className:
            'bg-success-50 text-success-700',
        }
      : delta > 0
        ? {
            label: 'HIGH',
            className:
              'bg-warning-50 text-warning-700',
          }
        : {
            label: 'LOW',
            className:
              'bg-error-50 text-error-700',
          };

  return (
    <span className={`rounded px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label} {delta >= 0 ? '+' : ''}
      {delta.toFixed(1)}°C
    </span>
  );
};
