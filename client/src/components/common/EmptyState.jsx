import React from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({
  icon: Icon = BookOpen,
  title,
  description,
  actionText,
  onAction,
  actionIcon,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-3xl border border-dashed border-[#DDCFC0] bg-[#FAF7F2] ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#F4ECE1] border border-[#DDCFC0] flex items-center justify-center text-[#1B4332] mb-4 shadow-xs">
        <Icon className="w-7 h-7 text-[#1B4332]" />
      </div>
      <h4 className="font-serif text-lg font-bold text-charcoal">{title}</h4>
      {description && (
        <p className="text-xs text-muted max-w-sm mt-1.5 mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <Button variant="primary" size="sm" onClick={onAction} icon={actionIcon}>
          {actionText}
        </Button>
      )}
    </div>
  );
}

export function LoadingSpinner({ text = 'Loading...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-7 h-7 border-3',
    lg: 'w-10 h-10 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted">
      <div
        className={`animate-spin rounded-full border-[#1B4332] border-t-transparent ${
          sizeClasses[size] || sizeClasses.md
        }`}
      />
      {text && <p className="text-xs font-semibold text-muted animate-pulse">{text}</p>}
    </div>
  );
}
