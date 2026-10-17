import React from 'react';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  icon: Icon,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variantStyles = {
    // Primary: Deep Forest Green background with crisp warm ivory text
    primary:
      'bg-[#1B4332] text-[#FAF7F2] hover:bg-[#143527] active:bg-[#0F291E] focus:ring-[#1B4332] shadow-sm',
    // Secondary: Light ivory/beige background with forest green text and visible border
    secondary:
      'bg-[#FAF7F2] text-[#1B4332] border border-[#DDCFC0] hover:bg-[#F2EDE4] hover:border-[#1B4332]/60 active:bg-[#ECE5D8] focus:ring-[#1B4332]',
    // Outline: White surface with charcoal text and warm border
    outline:
      'border border-[#D9D0C3] bg-white text-[#2E2E2E] hover:bg-[#FAF7F2] hover:text-[#1B4332] hover:border-[#1B4332]/60 active:bg-[#ECE5D8] focus:ring-[#1B4332]',
    // Accent: Terracotta
    accent:
      'bg-[#C97B63] text-white hover:bg-[#B56850] active:bg-[#9E4E37] focus:ring-[#C97B63] shadow-sm',
    // White CTA: For placement on dark banners (always high-contrast forest text)
    white:
      'bg-white text-[#1B4332] border border-[#DDCFC0] hover:bg-[#FAF7F2] active:bg-[#ECE5D8] focus:ring-[#1B4332] shadow-sm font-semibold',
    // Danger: Crimson with white text
    danger:
      'bg-[#B91C1C] text-white hover:bg-[#991B1B] active:bg-[#7F1D1D] focus:ring-[#B91C1C] shadow-sm',
    // Ghost: Subtle hover tint with dark charcoal text
    ghost:
      'text-[#2E2E2E] hover:bg-[#E7D7C1]/30 hover:text-[#1B4332] active:bg-[#E7D7C1]/50 focus:ring-[#6B8F71]',
  };

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant] || variantStyles.primary} ${
        sizeStyles[size] || sizeStyles.md
      } ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
    </button>
  );
}
