import React, { useState } from 'react';
import { Button } from '../common/Button';
import { borrowingApi } from '../../api/borrowing.api';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, Clock, Check } from 'lucide-react';

export function ConditionForm({
  sessionId,
  isGiver,
  isReceiver,
  giverConfirmedAt,
  receiverConfirmedAt,
  giverCondition,
  receiverCondition,
  onSuccess,
}) {
  const { showToast } = useToast();

  const userConfirmed = isGiver ? Boolean(giverConfirmedAt) : Boolean(receiverConfirmedAt);
  const otherConfirmed = isGiver ? Boolean(receiverConfirmedAt) : Boolean(giverConfirmedAt);

  const [rating, setRating] = useState('GOOD');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await borrowingApi.confirmCondition(sessionId, {
        condition_rating: rating,
        condition_notes: notes,
      });

      showToast(res.message || 'Book condition confirmed!', 'success');
      onSuccess?.(res);
    } catch (err) {
      setError(err.message || 'Failed to confirm condition.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Two-Sided Condition Confirmation
        </h4>
        <span className="text-[11px] font-medium text-slate-500">
          Role: <strong className="text-brand-700">{isGiver ? 'Current Custodian (Giver)' : 'Borrower (Receiver)'}</strong>
        </span>
      </div>

      {/* Two-Sided Status Badges */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2">
          {giverConfirmedAt ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <div>
            <p className="text-[11px] font-semibold text-slate-900">Custodian (Giver)</p>
            <p className="text-[10px] text-slate-500">
              {giverConfirmedAt ? `Confirmed (${giverCondition})` : 'Pending confirmation'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {receiverConfirmedAt ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <div>
            <p className="text-[11px] font-semibold text-slate-900">Borrower (Receiver)</p>
            <p className="text-[10px] text-slate-500">
              {receiverConfirmedAt ? `Confirmed (${receiverCondition})` : 'Pending confirmation'}
            </p>
          </div>
        </div>
      </div>

      {userConfirmed ? (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            You have already confirmed the book condition.
            {!otherConfirmed && ' Waiting for the other party to confirm.'}
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Physical Condition Rating *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['NEW', 'GOOD', 'FAIR', 'DAMAGED'].map((cond) => (
                <button
                  type="button"
                  key={cond}
                  onClick={() => setRating(cond)}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                    rating === cond
                      ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cond}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Condition Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Clean pages, slight spine wear..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={submitting}
            className="w-full"
          >
            Confirm Condition
          </Button>
        </form>
      )}
    </div>
  );
}
