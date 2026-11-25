import React from 'react';

interface LowerVibeLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showTagline?: boolean;
  isPlaying?: boolean;
  onClick?: () => void;
}

const BRAND_LOGO_SRC =
  '/assets/aistudio/hf_20261027_065809_f2446c35-920d-4d5a-a97a-dcfad0262ef1_802ab9c5.png';

export const LowerVibeMark: React.FC<{
  className?: string;
  animated?: boolean;
}> = ({ className = 'w-6 h-6', animated = false }) => (
  <svg
    viewBox="0 0 192 192"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="192" height="192" rx="44" fill="#0A0B0A" />
    <circle cx="96" cy="96" r="64" fill="none" stroke="#C6FF3D" strokeOpacity="0.32" strokeWidth="3" />
    <rect
      x="46"
      y="76"
      width="11"
      height="40"
      rx="5.5"
      fill="#7C5CFF"
      className={animated ? 'origin-center animate-eq-1' : undefined}
    />
    <rect
      x="68"
      y="62"
      width="11"
      height="68"
      rx="5.5"
      fill="#A5BE78"
      className={animated ? 'origin-center animate-eq-2' : undefined}
    />
    <rect
      x="90.5"
      y="50"
      width="11"
      height="92"
      rx="5.5"
      fill="#C6FF3D"
      className={animated ? 'origin-center animate-eq-3' : undefined}
    />
    <rect
      x="113"
      y="64"
      width="11"
      height="64"
      rx="5.5"
      fill="#C6FF3D"
      className={animated ? 'origin-center animate-eq-4' : undefined}
    />
    <rect
      x="135"
      y="78"
      width="11"
      height="36"
      rx="5.5"
      fill="#7C5CFF"
      className={animated ? 'origin-center animate-eq-2' : undefined}
    />
  </svg>
);

export const LowervibeCornerWatermark: React.FC<{
  position?: 'bottom-right' | 'bottom-left';
  compact?: boolean;
}> = ({ position = 'bottom-right', compact = false }) => (
  <span
    aria-hidden="true"
    className={`pointer-events-none select-none absolute ${
      position === 'bottom-left' ? 'bottom-1.5 left-1.5' : 'bottom-2 right-2'
    } inline-flex items-center gap-1 rounded-md bg-[#0A0B0A]/65 border border-[#C6FF3D]/30 ${
      compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-0.5 text-[9px]'
    } font-extrabold tracking-[0.06em] text-[#F4F5F3]/90`}
  >
    <span className="inline-flex items-center gap-[1.5px] h-2.5" aria-hidden="true">
      <span className="w-[1.5px] h-1.5 rounded-full bg-[#7C5CFF]" />
      <span className="w-[1.5px] h-2.5 rounded-full bg-[#C6FF3D]" />
      <span className="w-[1.5px] h-1.5 rounded-full bg-[#C6FF3D]" />
    </span>
    <span>LOWERVIBE</span>
  </span>
);

export const LowerVibeLogo: React.FC<LowerVibeLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = false,
  isPlaying = false,
  onClick,
}) => {
  const frameSizes: Record<NonNullable<LowerVibeLogoProps['size']>, string> = {
    sm: 'h-7 w-[112px] px-1.5 rounded-lg',
    md: 'h-8 sm:h-9 w-[126px] sm:w-[144px] px-2 rounded-xl',
    lg: 'h-12 w-[196px] px-2.5 rounded-2xl',
    hero: 'h-16 sm:h-20 w-[260px] sm:w-[320px] px-3 rounded-2xl',
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col select-none group ${onClick ? 'cursor-pointer' : ''} ${className}`}
      title="LOWERVIBE"
    >
      <div
        className={`relative overflow-hidden bg-white border border-[var(--border)] shadow-xs flex items-center justify-center transition-transform ${
          onClick ? 'group-hover:scale-[1.02] active:scale-[0.98]' : ''
        } ${isPlaying ? 'ring-1 ring-[var(--violet)]/45' : ''} ${frameSizes[size]}`}
      >
        <img
          src={BRAND_LOGO_SRC}
          alt="LOWERVIBE"
          draggable={false}
          className="w-full h-full object-cover object-[50%_52.5%] scale-[1.32] pointer-events-none select-none"
        />
      </div>

      {showTagline && (
        <span className="text-[11px] font-medium text-[var(--lv-muted)] mt-1">
          Independent music
        </span>
      )}
    </div>
  );
};
