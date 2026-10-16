import React, { useState } from 'react';
import { KeyRound, Copy, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export function PinDisplay({ pin, verifiedAt }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopied(true);
    showToast('Handover PIN copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  if (verifiedAt) {
    return (
      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
          <Check className="w-4 h-4" /> PIN Verified
        </span>
        <p className="text-xs text-emerald-600">
          The 4-digit PIN has been verified successfully.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-50 to-slate-50 border border-brand-200 text-center space-y-3 shadow-xs">
      <div className="flex items-center justify-center gap-2 text-xs font-semibold text-brand-800 uppercase tracking-wider">
        <KeyRound className="w-4 h-4 text-brand-600" />
        Handover Security PIN
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-slate-900 bg-white px-6 py-2.5 rounded-xl border border-brand-300 shadow-inner select-all">
          {pin || '••••'}
        </div>
        {pin && (
          <button
            onClick={handleCopy}
            className="p-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-xs transition-colors"
            title="Copy PIN"
            aria-label="Copy PIN"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
        Share this one-time 4-digit PIN with the borrower <strong>in person</strong> at the time
        of physical book exchange.
      </p>
    </div>
  );
}
