import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { booksApi } from '../../api/books.api';
import { useToast } from '../../context/ToastContext';
import { Search, BookPlus, Sparkles, Check, Info } from 'lucide-react';

export function DonateBookModal({ isOpen, onClose, libraryId, onSuccess, onBookDonated }) {
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
        title: formData.title.trim(),
        author: formData.author.trim(),
        isbn: formData.isbn.trim() || undefined,
        cover_image_url: formData.cover_image_url.trim() || undefined,
        genre: formData.genre.trim() || undefined,
        description: formData.description.trim() || undefined,
        initial_condition: formData.initial_condition,
      });

      showToast('Book successfully added to the library catalogue!', 'success');
      onSuccess?.();
      onBookDonated?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to add book.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add a Book to the Library"
      description="Share a physical book with your community. It will remain on your personal shelf until requested."
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {/* Open Library Lookup Form */}
        <form onSubmit={handleMetadataSearch} className="space-y-2">
          <label className="block text-xs font-bold text-charcoal">
            Auto-fill Book Details <span className="text-muted font-normal">(Optional ISBN or Title Search)</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ISBN or title on Open Library..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={searching}
              icon={Sparkles}
              className="font-semibold"
            >
              Search
            </Button>
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="border border-[#DDCFC0] rounded-2xl p-2 bg-[#FAF6EE] max-h-48 overflow-y-auto space-y-1.5 shadow-sm">
              <p className="text-[11px] font-bold text-charcoal px-2 py-1">
                Select matching book:
              </p>
              {searchResults.map((book, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectMetadata(book)}
                  className="flex items-center justify-between p-2 rounded-xl bg-white hover:bg-sage-tint/40 border border-transparent hover:border-sage-border/60 cursor-pointer text-xs transition-colors"
                >
                  <div className="truncate mr-2">
                    <p className="font-bold text-charcoal truncate">{book.title}</p>
                    <p className="text-[11px] text-muted truncate">by {book.author}</p>
                  </div>
                  <span className="text-[10px] text-forest font-bold shrink-0">Use &rarr;</span>
                </div>
              ))}
            </div>
          )}
        </form>

        {error && (
          <div className="p-3 rounded-xl bg-[#FAF0ED] border border-[#E8BDB1] text-[#A8452D] text-xs leading-relaxed">
            {error}
          </div>
        )}

        {/* Manual Metadata Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-[#E7D7C1]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Book Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Clean Code"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Author *
              </label>
              <input
                type="text"
                required
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="e.g. Robert C. Martin"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                ISBN <span className="text-muted font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                placeholder="Optional ISBN"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Genre
              </label>
              <input
                type="text"
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                placeholder="e.g. Fiction, Tech"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Initial Condition *
              </label>
              <select
                value={formData.initial_condition}
                onChange={(e) => setFormData({ ...formData, initial_condition: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white font-semibold"
              >
                <option value="NEW">New</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="DAMAGED">Damaged</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              Cover Image URL <span className="text-muted font-normal">(Optional)</span>
            </label>
            <input
              type="url"
              value={formData.cover_image_url}
              onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
              placeholder="https://... cover image url"
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              Notes or Description
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description or condition notes..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E7D7C1]">
            <Button variant="ghost" size="md" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
              icon={BookPlus}
              className="font-bold px-5"
            >
              Donate Book
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
