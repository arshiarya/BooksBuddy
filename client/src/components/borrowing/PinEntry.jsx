import React, { useState } from 'react';
import { Button } from '../common/Button';
import { borrowingApi } from '../../api/borrowing.api';
import { useToast } from '../../context/ToastContext';
import { KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';

export function PinEntry({ sessionId, verifiedAt, attemptsLeft = 3, onSuccess }) {
  const { showToast } = useToast();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (verifiedAt) {
    return (
      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
          <CheckCircle2 className="w-4 h-4" /> PIN Verified
        </span>
        <p className="text-xs text-emerald-600">
          You have successfully verified the 4-digit handover PIN!
        </p>
      </div>
    );
  }

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('Please enter a valid 4-digit numeric PIN.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await borrowingApi.verifyPin(sessionId, pin);
      showToast('PIN verified successfully!', 'success');
      onSuccess?.(res);
    } catch (err) {
      setError(err.message || 'Incorrect PIN entered.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-brand-600" />
          Enter Handover PIN
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          Attempts remaining: <strong className="text-slate-800">{attemptsLeft}</strong>
        </span>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Ask the current custodian for the 4-digit PIN when you meet in person to collect the book.
      </p>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-3">
        <div className="flex justify-center">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="0000"
            className="w-44 text-center font-mono text-2xl tracking-widest px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50 font-bold"
            disabled={submitting || attemptsLeft <= 0}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={submitting}
          disabled={pin.length !== 4 || attemptsLeft <= 0}
          className="w-full"
        >
          Verify PIN
        </Button>
      </form>
    </div>
  );
}
