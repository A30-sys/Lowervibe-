import React, { useEffect, useState } from 'react';
import { LOWERVIBE_ICON_ARTWORK } from '../../utils/artworkFallback';

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
  const [resolvedSrc, setResolvedSrc] = useState(src || LOWERVIBE_ICON_ARTWORK);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setResolvedSrc(src || LOWERVIBE_ICON_ARTWORK);
    setIsLoaded(false);
  }, [src]);

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
      className={`relative overflow-hidden bg-[var(--surface-2)] ${aspectClass} ${containerClassName}`}
    >
      {!isLoaded && (
        <div className="absolute inset-0 bg-[var(--surface-2)] pointer-events-none" />
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (resolvedSrc !== LOWERVIBE_ICON_ARTWORK) {
            setResolvedSrc(LOWERVIBE_ICON_ARTWORK);
          } else {
            setIsLoaded(true);
          }
        }}
        className={`w-full h-full object-cover transform-gpu transition-opacity duration-300 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
      />
    </div>
  );
};
