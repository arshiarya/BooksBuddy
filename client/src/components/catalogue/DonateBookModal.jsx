import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { booksApi } from '../../api/books.api';
import { useToast } from '../../context/ToastContext';
import { Search, BookPlus, Sparkles, Check, Info } from 'lucide-react';

export function DonateBookModal({ isOpen, onClose, libraryId, onSuccess }) {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    cover_image_url: '',
    genre: '',
    description: '',
    initial_condition: 'GOOD',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleMetadataSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError(null);
    try {
      const res = await booksApi.searchMetadata(searchQuery);
      setSearchResults(res.results || []);
    } catch (err) {
      setError('Unable to fetch Open Library metadata. You can enter details manually.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMetadata = (book) => {
    setFormData((prev) => ({
      ...prev,
      title: book.title || prev.title,
      author: book.author || prev.author,
      isbn: book.isbn || prev.isbn,
      cover_image_url: book.cover_url || prev.cover_image_url,
    }));
    setSearchResults([]);
    showToast('Book details auto-filled from Open Library!', 'success');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.author.trim()) {
      setError('Title and Author are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await booksApi.donate({
        library_id: libraryId,
        ...formData,
      });

      showToast('Book donated successfully to library collection!', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to donate book.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Donate a Book"
      description="Contribute a book to this community library collection."
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {/* Open Library Autocomplete Search */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            Quick Lookup via Open Library
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, or ISBN..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleMetadataSearch}
              loading={searching}
              icon={Sparkles}
            >
              Lookup
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 divide-y divide-slate-100 max-h-48 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xs">
              {searchResults.map((res, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectMetadata(res)}
                  className="p-2.5 hover:bg-brand-50/60 cursor-pointer flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="truncate">
                    <p className="font-semibold text-slate-900 truncate">{res.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{res.author}</p>
                  </div>
                  <span className="text-[11px] font-medium text-brand-700 shrink-0 flex items-center gap-1">
                    Select <Check className="w-3.5 h-3.5" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Physical Custody Info Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Decentralized custody:</strong> As the donor, this book remains physically with you
            until an approved member requests it and completes two-sided handover verification.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Book Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Clean Code"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Author *
              </label>
              <input
                type="text"
                required
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="e.g. Robert C. Martin"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ISBN</label>
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                placeholder="Optional ISBN"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Genre</label>
              <input
                type="text"
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                placeholder="e.g. Fiction, Tech"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Condition *
              </label>
              <select
                value={formData.initial_condition}
                onChange={(e) => setFormData({ ...formData, initial_condition: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="NEW">New</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="DAMAGED">Damaged</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cover Image URL
            </label>
            <input
              type="url"
              value={formData.cover_image_url}
              onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
              placeholder="https://... cover image url"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes or Description
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description or condition notes..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" size="md" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
              icon={BookPlus}
            >
              Donate Book
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
