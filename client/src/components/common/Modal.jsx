import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, description, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Warm Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F291E]/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        className={`relative bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] shadow-2xl w-full ${maxWidth} p-6 sm:p-8 overflow-hidden z-10 animate-in fade-in-0 zoom-in-95 duration-150`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E7D7C1]">
          <div>
            <h3 className="font-serif text-xl font-bold text-charcoal tracking-tight">{title}</h3>
            {description && <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted hover:text-charcoal hover:bg-[#F2EDE4] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pt-5">{children}</div>
      </div>
    </div>
  );
}
