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
      <div className="p-4 rounded-xl bg-forest-50 border border-forest-200 text-forest-900 text-center space-y-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-forest">
          <Check className="w-4 h-4" /> PIN Verified
        </span>
        <p className="text-xs text-forest-muted">
          The 4-digit PIN has been verified successfully.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-ivory to-beige-100 border border-beige-300 text-center space-y-3 shadow-warm">
      <div className="flex items-center justify-center gap-2 text-xs font-semibold text-forest uppercase tracking-wider">
        <KeyRound className="w-4 h-4 text-gold-600" />
        Handover Security PIN
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-forest bg-white px-6 py-2.5 rounded-xl border border-beige-300 shadow-inner select-all">
          {pin || '••••'}
        </div>
        {pin && (
          <button
            onClick={handleCopy}
            className="p-3 rounded-xl bg-white border border-beige-300 hover:bg-ivory text-charcoal-muted hover:text-forest shadow-xs transition-colors"
            title="Copy PIN"
            aria-label="Copy PIN"
          >
            {copied ? <Check className="w-5 h-5 text-forest" /> : <Copy className="w-5 h-5" />}
          </button>
        )}
      </div>

      <p className="text-xs text-charcoal-muted max-w-sm mx-auto leading-relaxed">
        Share this one-time 4-digit PIN with the borrower <strong>in person</strong> at the time
        of physical book exchange.
      </p>
    </div>
  );
}
