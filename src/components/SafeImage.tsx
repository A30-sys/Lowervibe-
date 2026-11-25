import React, { useEffect, useState } from 'react';
import { LOWERVIBE_ICON_ARTWORK } from '../utils/artworkFallback';
import { resolveMediaAssetFallbackUrl } from '../utils/mediaRecovery';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  containerClassName?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt = 'Image',
  className = '',
  containerClassName = '',
  fallbackSrc = LOWERVIBE_ICON_ARTWORK,
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);
  const [triedMediaRecovery, setTriedMediaRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(src && src !== fallbackSrc));

  useEffect(() => {
    const nextSrc = src || fallbackSrc;
    setImgSrc(nextSrc);
    setHasError(false);
    setTriedMediaRecovery(false);
    setIsLoading(Boolean(src && src !== fallbackSrc));
  }, [src, fallbackSrc]);

  const handleError = async () => {
    if (!triedMediaRecovery && typeof imgSrc === 'string' && imgSrc.startsWith('/api/media/')) {
      setTriedMediaRecovery(true);
      const recovered = await resolveMediaAssetFallbackUrl(imgSrc);
      if (recovered) {
        setImgSrc(recovered);
        return;
      }
    }
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallbackSrc);
      setIsLoading(false);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className={`relative overflow-hidden bg-[var(--surface-2)] ${containerClassName}`}>
      {isLoading && <div className="absolute inset-0 bg-[var(--surface-2)]" />}
      <img
        {...props}
        src={imgSrc}
        alt={alt}
        onError={() => {
          void handleError();
        }}
        onLoad={handleLoad}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
      />
    </div>
  );
};
