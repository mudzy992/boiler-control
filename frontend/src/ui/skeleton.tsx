import { cn } from './cn';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    className={cn('animate-pulse rounded-control bg-raised', className)}
    aria-hidden
  />
);
