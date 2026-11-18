import React, { useState } from 'react';
import { DEFAULT_ARTWORK_SVG } from '../utils/artworkFallback';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  containerClassName?: string;
}

const DEFAULT_FALLBACK_ART = DEFAULT_ARTWORK_SVG;

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt = 'Image',
  className = '',
  containerClassName = '',
  fallbackSrc = DEFAULT_FALLBACK_ART,
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
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
    <div className={`relative overflow-hidden bg-[#16161E] ${containerClassName}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-white/5 animate-pulse" />
      )}
      <img
        {...props}
        src={imgSrc}
        alt={alt}
        onError={handleError}
        onLoad={handleLoad}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      />
    </div>
  );
};
