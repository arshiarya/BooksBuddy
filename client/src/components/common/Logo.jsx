import React from 'react';

/**
 * BooksBuddy Visual Identity Mark:
 * An elegant open book subtly combined with a sprouting leaf/community motif.
 * Features Deep Forest Green (#1B4332), Sage (#6B8F71), and a warm Gold/Terracotta accent (#D4A373).
 */
export function LogoIcon({ className = 'w-9 h-9', size = 36 }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      {/* Soft rounded container */}
      <rect width="48" height="48" rx="13" fill="#1B4332" />

      {/* Left Book Page */}
      <path
        d="M24 35C19.8 32 14.2 31.6 9.8 32.7V15.5C14.2 14.4 19.8 14.8 24 17.8V35Z"
        fill="#F6F1E7"
      />
      {/* Right Book Page */}
      <path
        d="M24 35C28.2 32 33.8 31.6 38.2 32.7V15.5C33.8 14.4 28.2 14.8 24 17.8V35Z"
        fill="#FAF7F2"
      />

      {/* Spine divider */}
      <path d="M24 17.5V35" stroke="#D4A373" strokeWidth="1.2" strokeLinecap="round" />

      {/* Sprouting leaf / community motif rising gracefully from spine */}
      <path
        d="M24 19C24 13.5 24 9.5 24 8"
        stroke="#6B8F71"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Left Leaflet */}
      <path
        d="M24 14C20.8 13.2 18 10 18.8 6.8C22 6.8 24 10 24 14Z"
        fill="#8EAE93"
      />
      {/* Right Leaflet */}
      <path
        d="M24 11.5C27.2 10.7 29.5 7.5 28.7 4.5C25.5 4.5 24 7.5 24 11.5Z"
        fill="#6B8F71"
      />

      {/* Small bookmark ribbon at base */}
      <path d="M24 35V39L26 37.5L28 39V35H24Z" fill="#D4A373" />
    </svg>
  );
}

export function Logo({
  variant = 'full', // 'full' | 'compact' | 'icon'
  size = 'md', // 'sm' | 'md' | 'lg'
  className = '',
  onClick,
}) {
  const iconSizes = {
    sm: 28,
    md: 38,
    lg: 48,
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const currentIconSize = iconSizes[size] || iconSizes.md;

  if (variant === 'icon') {
    return (
      <div onClick={onClick} className={`inline-flex items-center cursor-pointer select-none ${className}`}>
        <LogoIcon size={currentIconSize} />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none group ${className}`}
    >
      <div className="transition-transform duration-200 group-hover:scale-105">
        <LogoIcon size={currentIconSize} />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span
            className={`font-serif font-bold text-charcoal tracking-tight group-hover:text-forest transition-colors ${
              textSizes[size] || textSizes.md
            }`}
          >
            BooksBuddy
          </span>
          <span className="text-[10px] uppercase tracking-wider font-bold bg-sage-tint text-forest border border-sage-border/60 px-1.5 py-0.5 rounded-md">
            Library
          </span>
        </div>
        {variant === 'full' && (
          <p className="text-[11px] font-medium text-muted -mt-0.5 tracking-tight">
            Community Virtual Library
          </p>
        )}
      </div>
    </div>
  );
}
