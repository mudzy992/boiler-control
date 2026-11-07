import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import type { HeatingBucket } from '../types';

interface DashboardBucketChartProps {
  buckets: HeatingBucket[];
  activeBucket: string | null;
  onActiveBucketChange: (label: string | null) => void;
}

export const DashboardBucketChart = ({
  buckets,
  activeBucket,
  onActiveBucketChange,
}: DashboardBucketChartProps): JSX.Element => {
  const { t } = useTranslation();
  const maxDuration = Math.max(...buckets.map((b) => b.totalDurationMin), 1);
  const chartHeight = 200;
  const barWidth = 28;
  const gap = 12;
  const width = Math.max(buckets.length * (barWidth + gap), 120);

  if (buckets.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t('dashboard.noBuckets')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <svg
        role="img"
        aria-label={t('dashboard.chartAria')}
        viewBox={`0 0 ${width} ${chartHeight + 28}`}
        className="h-[228px] w-full max-w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {buckets.map((bucket, index) => {
          const barH = (bucket.totalDurationMin / maxDuration) * chartHeight;
          const x = index * (barWidth + gap) + gap / 2;
          const y = chartHeight - barH;
          const isActive = activeBucket === bucket.label;
          return (
            <g key={bucket.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 2)}
                rx={4}
                className={cn(
                  isActive ? 'fill-accent' : 'fill-muted-foreground/40',
                  'cursor-pointer transition-colors',
                )}
                tabIndex={0}
                role="button"
                aria-label={`${bucket.label}: ${bucket.totalDurationMin} min, ${bucket.cycles} ${t('dashboard.cycles')}`}
                aria-pressed={isActive}
                onMouseEnter={() => onActiveBucketChange(bucket.label)}
                onMouseLeave={() => onActiveBucketChange(null)}
                onFocus={() => onActiveBucketChange(bucket.label)}
                onBlur={() => onActiveBucketChange(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onActiveBucketChange(isActive ? null : bucket.label);
                  }
                }}
              />
              <text
                x={x + barWidth / 2}
                y={chartHeight + 16}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {bucket.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {activeBucket
          ? (() => {
              const b = buckets.find((x) => x.label === activeBucket);
              return b
                ? t('dashboard.bucketSummary', {
                    label: b.label,
                    minutes: b.totalDurationMin,
                    cycles: b.cycles,
                  })
                : t('dashboard.chartHint');
            })()
          : t('dashboard.chartHint')}
      </p>
    </div>
  );
};
