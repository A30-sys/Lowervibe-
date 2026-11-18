import React from 'react';

interface SoundwaveIconProps {
  className?: string;
  isPlaying?: boolean;
  barColor?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SoundwaveIcon: React.FC<SoundwaveIconProps> = ({
  className = '',
  isPlaying = false,
  barColor = 'currentColor',
  size = 'md',
}) => {
  // 7 vertical bars, tallest in the middle (percentages of container height)
  // [30%, 55%, 80%, 100%, 80%, 55%, 30%]
  const barHeights = [28, 52, 78, 100, 78, 52, 28];

  const sizeClasses = {
    sm: 'w-4 h-4 gap-[1.5px]',
    md: 'w-6 h-6 gap-[2px]',
    lg: 'w-8 h-8 gap-[3px]',
  };

  return (
    <div
      className={`inline-flex items-center justify-center ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    >
      {barHeights.map((height, idx) => (
        <span
          key={idx}
          className={`w-[2px] sm:w-[2.5px] rounded-full transition-all duration-300 ${
            isPlaying ? `animate-eq-${(idx % 4) + 1}` : ''
          }`}
          style={{
            height: `${height}%`,
            backgroundColor: barColor === 'violet' ? '#6C4BFF' : barColor === 'lime' ? '#C6FF4F' : barColor,
          }}
        />
      ))}
    </div>
  );
};
