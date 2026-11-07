import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './icon-button';

export type BannerTone = 'ok' | 'warn' | 'fault' | 'info';

const toneClass: Record<BannerTone, string> = {
  ok: 'border-ok/40 bg-ok/10 text-ok',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  fault: 'border-fault/40 bg-fault/10 text-fault',
  info: 'border-info/40 bg-info/10 text-info',
};

export interface BannerProps {
  tone?: BannerTone;
  message: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

export const Banner = ({
  tone = 'info',
  message,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
}: BannerProps) => (
  <div
    role={tone === 'fault' ? 'alert' : 'status'}
    aria-live={tone === 'fault' ? 'assertive' : 'polite'}
    className={cn(
      'flex items-start gap-3 rounded-panel border px-3 py-2.5 text-sm',
      toneClass[tone],
      className,
    )}
  >
    <div className="min-w-0 flex-1">{message}</div>
    {onDismiss ? (
      <IconButton
        variant="ghost"
        aria-label={dismissLabel}
        className="h-7 w-7 text-current"
        onClick={onDismiss}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </IconButton>
    ) : null}
  </div>
);
