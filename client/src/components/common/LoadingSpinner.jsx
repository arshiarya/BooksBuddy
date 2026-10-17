import React from 'react';

export function LoadingSpinner({ text = 'Loading...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-7 h-7 border-3',
    lg: 'w-10 h-10 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-charcoal-muted">
      <div
        className={`animate-spin rounded-full border-forest border-t-transparent ${
          sizeClasses[size] || sizeClasses.md
        }`}
      />
      {text && <p className="text-xs font-medium text-charcoal-muted animate-pulse">{text}</p>}
    </div>
  );
}
