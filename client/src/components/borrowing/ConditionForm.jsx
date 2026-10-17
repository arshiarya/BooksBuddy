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
    <div className="p-5 rounded-2xl bg-white/90 backdrop-blur-xs border border-beige-300 space-y-4 shadow-warm">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-forest uppercase tracking-wider">
          Two-Sided Condition Confirmation
        </h4>
        <span className="text-[11px] font-medium text-charcoal-muted">
          Role: <strong className="text-forest">{isGiver ? 'Current Holder (Giver)' : 'Receiver'}</strong>
        </span>
      </div>

      {/* Two-Sided Status Badges */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-ivory/60 border border-beige-300">
        <div className="flex items-center gap-2">
          {giverConfirmedAt ? (
            <CheckCircle2 className="w-4 h-4 text-forest shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-gold-600 shrink-0" />
          )}
          <div>
            <p className="text-[11px] font-semibold text-charcoal">Current Holder (Giver)</p>
            <p className="text-[10px] text-charcoal-muted">
              {giverConfirmedAt ? `Confirmed (${giverCondition})` : 'Pending confirmation'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {receiverConfirmedAt ? (
            <CheckCircle2 className="w-4 h-4 text-forest shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-gold-600 shrink-0" />
          )}
          <div>
            <p className="text-[11px] font-semibold text-charcoal">Receiver</p>
            <p className="text-[10px] text-charcoal-muted">
              {receiverConfirmedAt ? `Confirmed (${receiverCondition})` : 'Pending confirmation'}
            </p>
          </div>
        </div>
      </div>

      {userConfirmed ? (
        <div className="p-3.5 rounded-xl bg-forest-50 border border-forest-200 text-forest-900 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-forest shrink-0" />
          <div>
            <p className="font-bold">Your confirmation is complete.</p>
            <p className="text-[11px] text-forest-700">
              {!otherConfirmed
                ? 'Handover remains in progress until the other party confirms condition.'
                : 'Both parties confirmed. Book handover is complete!'}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {error && (
            <div className="p-3 rounded-xl bg-terracotta-50 border border-terracotta-200 text-terracotta-800 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
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
                      ? 'bg-forest text-ivory border-forest shadow-xs font-bold'
                      : 'bg-ivory/60 text-charcoal border-beige-300 hover:bg-beige-200'
                  }`}
                >
                  {cond}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Condition Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Clean pages, slight spine wear..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-beige-300 focus:outline-none focus:ring-2 focus:ring-forest bg-white/90"
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
