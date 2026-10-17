import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-card-hover text-sm transition-all duration-200 animate-in slide-in-from-bottom-2 ${
              toast.type === 'success'
                ? 'bg-[#EDF6EC] border-[#B2CCBD] text-[#1B4332]'
                : toast.type === 'error'
                ? 'bg-[#FAF0ED] border-[#E8BDB1] text-[#A8452D]'
                : 'bg-[#FDFBF7] border-[#DDCFC0] text-[#2E2E2E]'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#1B4332] shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-[#C97B63] shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-[#1B4332] shrink-0 mt-0.5" />}

            <div className="flex-1 font-semibold text-xs leading-relaxed">{toast.message}</div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg text-muted hover:text-charcoal hover:bg-[#F2EDE4] transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
