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
    <div className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-4 shadow-sm">
        <Icon className="w-6 h-6 text-slate-500" />
      </div>
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      {description && (
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-6 leading-relaxed">
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
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
      <div
        className={`animate-spin rounded-full border-brand-500 border-t-transparent ${
          sizeClasses[size] || sizeClasses.md
        }`}
      />
      {text && <p className="text-xs font-medium text-slate-500 animate-pulse">{text}</p>}
    </div>
  );
}
