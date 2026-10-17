import React from 'react';

export function Badge({ children, variant = 'neutral', size = 'md', className = '' }) {
  const variantStyles = {
    neutral: 'bg-[#F4ECE1] text-[#2E2E2E] border-[#DDCFC0]',
    primary: 'bg-[#EDF6EC] text-[#1B4332] border-[#C4D7C8]',
    success: 'bg-[#EDF6EC] text-[#1B4332] border-[#B2CCBD]',
    warning: 'bg-[#FAF4ED] text-[#8C5D23] border-[#E7C8AA]',
    danger: 'bg-[#FAF0ED] text-[#A8452D] border-[#E8BDB1]',
    info: 'bg-[#F0F5F8] text-[#2C5282] border-[#CBD5E1]',
    purple: 'bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]',
    terracotta: 'bg-[#FAF0ED] text-[#A8452D] border-[#E8BDB1]',
    gold: 'bg-[#FAF4ED] text-[#8C5D23] border-[#E7C8AA]',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] font-semibold',
    md: 'px-2.5 py-0.5 text-xs font-semibold',
    lg: 'px-3 py-1 text-sm font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border transition-colors ${
        variantStyles[variant] || variantStyles.neutral
      } ${sizeStyles[size] || sizeStyles.md} ${className}`}
    >
      {children}
    </span>
  );
}
