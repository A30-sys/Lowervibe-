import React, { useState } from 'react';
import { Music } from 'lucide-react';

interface LazySlideImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
}

export const LazySlideImage: React.FC<LazySlideImageProps> = ({
  src,
  alt,
  className = '',
  containerClassName = '',
  aspectRatio = 'square',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'portrait'
      ? 'aspect-[3/4]'
      : '';

  return (
    <div
      className={`relative overflow-hidden bg-[#121218] ${aspectClass} ${containerClassName}`}
    >
      {/* Shimmer Placeholder while loading */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 shimmer-placeholder pointer-events-none" />
      )}

      {/* Fallback if error */}
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A24] text-[#A0A0A8]">
          <Music className="w-6 h-6 opacity-40" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover transform-gpu transition-all duration-500 ease-out ${
            isLoaded
              ? 'opacity-100 scale-100 filter-none'
              : 'opacity-0 scale-105 filter blur-xs'
          } ${className}`}
        />
      )}
    </div>
  );
};
