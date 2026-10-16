import React, { useState, useEffect } from 'react';
import { communityApi } from '../../api/community.api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { EmptyState, LoadingSpinner } from '../common/EmptyState';
import { ThumbsUp, Plus, Sparkles, BookHeart, Check, MessageSquare } from 'lucide-react';

export function BookDemandsTab({ libraryId }) {
  const { user, isLibrarianOf } = useAuth();
  const { showToast } = useToast();
  const isLibrarian = isLibrarianOf(libraryId);

  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadDemands = async () => {
    try {
      const res = await communityApi.listDemands(libraryId);
      setDemands(res.demands || []);
    } catch (err) {
      showToast(err.message || 'Failed to load book demands.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDemands();
  }, [libraryId]);

  const handleVote = async (demandId) => {
    try {
      const res = await communityApi.toggleVote(demandId);
      setDemands((prev) =>
        prev.map((d) =>
          d.id === demandId
            ? {
                ...d,
                has_voted: res.has_voted,
                upvotes_count: res.upvotes_count,
              }
            : d
        )
      );
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to toggle vote.', 'error');
    }
  };

  const handleCreateDemand = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.author.trim()) {
      showToast('Title and Author are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await communityApi.createDemand(libraryId, formData);
      showToast('Book demand posted successfully with your vote!', 'success');
      setFormData({ title: '', author: '', isbn: '', notes: '' });
      setShowCreateModal(false);
      loadDemands();
    } catch (err) {
      showToast(err.message || 'Failed to submit demand.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (demandId, status) => {
    try {
      await communityApi.updateDemandStatus(demandId, { status });
      showToast('Demand status updated.', 'success');
      loadDemands();
    } catch (err) {
      showToast(err.message || 'Failed to update demand status.', 'error');
    }
  };

  const statusVariant = {
    REQUESTED: 'neutral',
    SOURCING: 'warning',
    ACQUIRED: 'info',
    FULFILLED: 'success',
    CANCELLED: 'danger',
  };

  return (
    <div className="space-y-6">
      {/* Header & CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookHeart className="w-5 h-5 text-brand-600" />
            Community Book Wishlist & Demands
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Vote on books you'd like added to our library or submit a wish for the community to source.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          icon={Plus}
        >
          Wish for a Book
        </Button>
      </div>

      {/* Demands List */}
      {loading ? (
        <LoadingSpinner text="Loading book demands..." />
      ) : demands.length === 0 ? (
        <EmptyState
          icon={BookHeart}
          title="No book demands yet"
          description="Is there a book you're eager to read? Start the wishlist for this library!"
          actionText="Submit First Book Wish"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {demands.map((demand) => (
            <div
              key={demand.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">
                      {demand.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">by {demand.author}</p>
                  </div>
                  <Badge variant={statusVariant[demand.status] || 'neutral'} size="sm">
                    {demand.status}
                  </Badge>
                </div>

                {demand.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
                    "{demand.notes}"
                  </p>
                )}

                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span>Requested by {demand.requester_name || 'Member'}</span>
                  {demand.isbn && <span>ISBN: {demand.isbn}</span>}
                </div>
              </div>

              {/* Actions & Upvote */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleVote(demand.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all select-none ${
                    demand.has_voted
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <ThumbsUp className={`w-3.5 h-3.5 ${demand.has_voted ? 'fill-current' : ''}`} />
                  <span>{demand.upvotes_count || 0} Upvotes</span>
                </button>

                {/* Librarian Status Dropdown */}
                {isLibrarian && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Status:</span>
                    <select
                      value={demand.status}
                      onChange={(e) => handleUpdateStatus(demand.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="REQUESTED">REQUESTED</option>
                      <option value="SOURCING">SOURCING</option>
                      <option value="ACQUIRED">ACQUIRED</option>
                      <option value="FULFILLED">FULFILLED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Demand Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-0 zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">Wish for a Book</h3>
            <p className="text-xs text-slate-500">
              Your request will be visible to all members and automatically records your upvote.
            </p>

            <form onSubmit={handleCreateDemand} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Book Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Sapiens"
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
                  placeholder="e.g. Yuval Noah Harari"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ISBN (Optional)
                </label>
                <input
                  type="text"
                  value={formData.isbn}
                  onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                  placeholder="e.g. 9780062316097"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Why do you recommend this book? (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Tell your neighbors why we should have this in our library..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  icon={BookHeart}
                >
                  Post Book Wish
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
