import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`shimmer-placeholder rounded-2xl bg-[var(--lv-elevated)] border border-[var(--lv-border)] ${className}`}
  />
);

export const TrackRowSkeleton: React.FC = () => (
  <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--lv-surface)] border border-[var(--lv-border)]">
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
      <div className="space-y-2 flex-1 max-w-[220px]">
        <Skeleton className="h-3.5 w-3/4 rounded-lg" />
        <Skeleton className="h-3 w-1/2 rounded-lg" />
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <Skeleton className="w-10 h-10 rounded-full" />
    </div>
  </div>
);

export const TrackCardSkeleton: React.FC = () => (
  <div className="shrink-0 w-40 sm:w-44 p-3 rounded-[20px] bg-[var(--lv-surface)] border border-[var(--lv-border)] space-y-3">
    <Skeleton className="aspect-square w-full rounded-2xl" />
    <div className="space-y-1.5">
      <Skeleton className="h-3.5 w-4/5 rounded-lg" />
      <Skeleton className="h-3 w-3/5 rounded-lg" />
    </div>
  </div>
);

export const ArtistCardSkeleton: React.FC = () => (
  <div className="shrink-0 w-36 sm:w-40 p-4 rounded-[20px] bg-[var(--lv-surface)] border border-[var(--lv-border)] text-center space-y-3">
    <Skeleton className="w-20 h-20 rounded-full mx-auto" />
    <div className="space-y-1.5">
      <Skeleton className="h-3.5 w-3/4 mx-auto rounded-lg" />
      <Skeleton className="h-2.5 w-1/2 mx-auto rounded-lg" />
    </div>
  </div>
);

export const HeroSkeleton: React.FC = () => (
  <div className="rounded-[28px] bg-[var(--lv-surface)] border border-[var(--lv-border)] p-5 sm:p-8 flex flex-col md:flex-row items-center gap-6">
    <Skeleton className="w-full sm:w-56 md:w-64 aspect-square rounded-[20px] shrink-0" />
    <div className="flex-1 w-full space-y-4">
      <Skeleton className="h-4 w-28 rounded-lg" />
      <Skeleton className="h-8 sm:h-10 w-3/4 rounded-xl" />
      <Skeleton className="h-4 w-1/2 rounded-lg" />
      <div className="flex items-center gap-3 pt-2">
        <Skeleton className="w-36 h-12 rounded-2xl" />
        <Skeleton className="w-12 h-12 rounded-2xl" />
      </div>
    </div>
  </div>
);

export const ShelfSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-40 rounded-lg" />
      <Skeleton className="h-4 w-16 rounded-lg" />
    </div>
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <TrackCardSkeleton key={i} />
      ))}
    </div>
  </div>
);
