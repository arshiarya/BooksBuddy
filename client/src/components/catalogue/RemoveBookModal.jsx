import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { booksApi } from '../../api/books.api';
import { useToast } from '../../context/ToastContext';
import { Trash2, AlertTriangle } from 'lucide-react';

export function RemoveBookModal({ isOpen, onClose, book, onSuccess }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!book) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A mandatory removal reason must be provided.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await booksApi.remove(book.id, reason.trim());
      showToast('Book removed from catalogue.', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to remove book.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remove Book from Catalogue"
      description={`De-list "${book.title}" from active library availability.`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-terracotta-50 border border-terracotta-200 text-terracotta-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-terracotta shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Removing this book marks it as <strong>REMOVED</strong>. It will no longer be available
            for borrowing. Historical custody records remain preserved.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-terracotta-50 border border-terracotta-200 text-terracotta-800 text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-charcoal mb-1">
            Removal Reason *
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Lost, severe water damage, donor request..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-beige-300 focus:outline-none focus:ring-2 focus:ring-terracotta bg-white/90"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-beige-200">
          <Button variant="outline" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            size="md"
            loading={submitting}
            icon={Trash2}
          >
            Confirm Removal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
