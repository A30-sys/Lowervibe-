import React, { useEffect, useState } from 'react';
import { LOWERVIBE_ICON_ARTWORK } from '../../utils/artworkFallback';
import { resolveMediaAssetFallbackUrl } from '../../utils/mediaRecovery';
import { LowervibeCornerWatermark } from '../brand/LowerVibeLogo';

interface LazySlideImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  watermark?: boolean;
  watermarkPosition?: 'bottom-right' | 'bottom-left';
  watermarkCompact?: boolean;
}

export const LazySlideImage: React.FC<LazySlideImageProps> = ({
  src,
  alt,
  className = '',
  containerClassName = '',
  aspectRatio = 'square',
  watermark = false,
  watermarkPosition = 'bottom-right',
  watermarkCompact = true,
}) => {
  const [resolvedSrc, setResolvedSrc] = useState(src || LOWERVIBE_ICON_ARTWORK);
  const [isLoaded, setIsLoaded] = useState(false);
  const [triedMediaRecovery, setTriedMediaRecovery] = useState(false);

  useEffect(() => {
    setResolvedSrc(src || LOWERVIBE_ICON_ARTWORK);
    setIsLoaded(false);
    setTriedMediaRecovery(false);
  }, [src]);

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'portrait'
      ? 'aspect-[3/4]'
      : '';

  const showWatermarkOverlay =
    watermark &&
    isLoaded &&
    Boolean(resolvedSrc) &&
    resolvedSrc !== LOWERVIBE_ICON_ARTWORK &&
    !resolvedSrc.startsWith('data:image/svg+xml');

  const handleImageError = async () => {
    if (!triedMediaRecovery && resolvedSrc.startsWith('/api/media/')) {
      setTriedMediaRecovery(true);
      const recovered = await resolveMediaAssetFallbackUrl(resolvedSrc);
      if (recovered) {
        setResolvedSrc(recovered);
        return;
      }
    }
    if (resolvedSrc !== LOWERVIBE_ICON_ARTWORK) {
      setResolvedSrc(LOWERVIBE_ICON_ARTWORK);
    } else {
      setIsLoaded(true);
    }
  };

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
          void handleImageError();
        }}
        className={`w-full h-full object-cover transform-gpu transition-opacity duration-300 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
      />
      {showWatermarkOverlay && (
        <LowervibeCornerWatermark position={watermarkPosition} compact={watermarkCompact} />
      )}
    </div>
  );
};
