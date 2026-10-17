import React, { useState, useEffect } from 'react';
import { librariesApi } from '../../api/libraries.api';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Sliders, Save, Info } from 'lucide-react';

export function RulesTab({ library, onRulesUpdated }) {
  const { showToast } = useToast();

  const [rules, setRules] = useState({
    max_borrow_days: library?.max_borrow_days || 14,
    handover_window_hours: library?.handover_window_hours || 48,
    max_books_per_member: library?.max_books_per_member || 3,
    max_renewals: library?.max_renewals || 1,
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (library) {
      setRules({
        max_borrow_days: library.max_borrow_days ?? 14,
        handover_window_hours: library.handover_window_hours ?? 48,
        max_books_per_member: library.max_books_per_member ?? 3,
        max_renewals: library.max_renewals ?? 1,
      });
    }
  }, [library]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        max_borrow_days: parseInt(rules.max_borrow_days, 10) || 14,
        handover_window_hours: parseInt(rules.handover_window_hours, 10) || 48,
        max_books_per_member: parseInt(rules.max_books_per_member, 10) || 3,
        max_renewals: parseInt(rules.max_renewals, 10) ?? 1,
      };
      await librariesApi.updateRules(library.id, payload);
      showToast('Library borrowing rules updated successfully!', 'success');
      onRulesUpdated?.();
    } catch (err) {
      showToast(err.message || 'Failed to update library rules.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-xs p-6 rounded-2xl border border-beige-300 shadow-warm space-y-6 max-w-2xl">
      <div>
        <h4 className="font-serif text-base font-bold text-forest flex items-center gap-2">
          <Sliders className="w-4 h-4 text-forest-light" />
          Configurable Borrowing & Queue Rules
        </h4>
        <p className="text-xs text-charcoal-muted mt-1">
          Adjust loan periods, physical handover expiry limits, and member borrow quotas for this library.
        </p>
      </div>

      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-ivory/80 border border-beige-300 text-charcoal text-xs">
        <Info className="w-4 h-4 text-forest shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Dynamic rule enforcement:</strong> These parameters dictate borrowing deadlines,
          queue reservation windows, and automated handover PIN expirations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Max Borrow Duration (Days)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={rules.max_borrow_days}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setRules({ ...rules, max_borrow_days: val ? parseInt(val, 10) : '' });
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-beige-300 focus:outline-none focus:ring-2 focus:ring-forest bg-white/90"
            />
            <p className="text-[11px] text-charcoal-muted mt-1">
              Allowed loan period before due date ({rules.max_borrow_days || 14} days).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Handover Window (Hours)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={rules.handover_window_hours}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setRules({ ...rules, handover_window_hours: val ? parseInt(val, 10) : '' });
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-beige-300 focus:outline-none focus:ring-2 focus:ring-forest bg-white/90"
            />
            <p className="text-[11px] text-charcoal-muted mt-1">
              Time to meet & verify PIN before handover session expires ({rules.handover_window_hours || 48}h).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Max Active Books Per Member
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={rules.max_books_per_member}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setRules({ ...rules, max_books_per_member: val ? parseInt(val, 10) : '' });
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-beige-300 focus:outline-none focus:ring-2 focus:ring-forest bg-white/90"
            />
            <p className="text-[11px] text-charcoal-muted mt-1">Simultaneous active loans per member.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Max Allowed Renewals
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={rules.max_renewals}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setRules({ ...rules, max_renewals: val ? parseInt(val, 10) : 0 });
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-beige-300 focus:outline-none focus:ring-2 focus:ring-forest bg-white/90"
            />
            <p className="text-[11px] text-charcoal-muted mt-1">Permitted loan extensions if no waitlist.</p>
          </div>
        </div>

        <div className="pt-3 border-t border-beige-200 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={submitting}
            icon={Save}
          >
            Save Library Rules
          </Button>
        </div>
      </form>
    </div>
  );
}
