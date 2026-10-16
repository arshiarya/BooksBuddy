import React, { useState, useEffect } from 'react';
import { communityApi } from '../../api/community.api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { EmptyState, LoadingSpinner } from '../common/EmptyState';
import { Bell, Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';

export function NoticesTab({ libraryId }) {
  const { user, isLibrarianOf } = useAuth();
  const { showToast } = useToast();
  const isLibrarian = isLibrarianOf(libraryId);

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    priority: 'NORMAL',
    expires_at: tomorrowStr,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadNotices = async () => {
    try {
      const res = await communityApi.listNotices(libraryId, category);
      setNotices(res.notices || []);
    } catch (err) {
      showToast(err.message || 'Failed to load community notices.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, [libraryId, category]);

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      showToast('Title and Content are required.', 'error');
      return;
    }

    const expDate = new Date(formData.expires_at);
    if (isNaN(expDate.getTime()) || expDate <= new Date()) {
      showToast('Expiry date must be in the future.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await communityApi.createNotice(libraryId, {
        ...formData,
        expires_at: expDate.toISOString(),
      });
      showToast('Community notice published!', 'success');
      setFormData({
        title: '',
        content: '',
        category: 'GENERAL',
        priority: 'NORMAL',
        expires_at: tomorrowStr,
      });
      setShowCreateModal(false);
      loadNotices();
    } catch (err) {
      showToast(err.message || 'Failed to publish notice.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('Are you sure you want to delete this notice?')) return;

    try {
      await communityApi.deleteNotice(noticeId);
      showToast('Notice deleted.', 'success');
      setNotices((prev) => prev.filter((n) => n.id !== noticeId));
    } catch (err) {
      showToast(err.message || 'Failed to delete notice.', 'error');
    }
  };

  const categories = ['ALL', 'GENERAL', 'EVENT', 'RULE_CHANGE', 'LOST_FOUND'];

  const categoryBadgeVariant = {
    GENERAL: 'neutral',
    EVENT: 'info',
    RULE_CHANGE: 'danger',
    LOST_FOUND: 'warning',
  };

  return (
    <div className="space-y-6">
      {/* Category Tabs & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                category === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          icon={Plus}
        >
          Post Notice
        </Button>
      </div>

      {/* Notices Feed */}
      {loading ? (
        <LoadingSpinner text="Loading notices..." />
      ) : notices.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Notice board is clear"
          description="No active announcements or notices currently posted for this category."
          actionText="Post First Notice"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notices.map((notice) => {
            const isAuthor = notice.author_id === user?.id;
            const canDelete = isAuthor || isLibrarian;

            return (
              <div
                key={notice.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">
                      {notice.title}
                    </h4>
                    <Badge variant={categoryBadgeVariant[notice.category] || 'neutral'} size="sm">
                      {notice.category}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {notice.content}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="space-y-0.5">
                    <p className="font-medium text-slate-600">
                      Posted by {notice.author_name || 'Member'}
                    </p>
                    <p className="flex items-center gap-1 text-[10px]">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Expires: {new Date(notice.expires_at).toLocaleDateString()}
                    </p>
                  </div>

                  {canDelete && (
                    <button
                      onClick={() => handleDeleteNotice(notice.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title={isAuthor ? 'Delete my notice' : 'Moderator delete'}
                      aria-label="Delete notice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Post Notice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-0 zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">Post Community Notice</h3>
            <p className="text-xs text-slate-500">
              Share an announcement, event, or rule update with library members.
            </p>

            <form onSubmit={handleCreateNotice} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Weekend Book Swap Meetup"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="GENERAL">GENERAL</option>
                    <option value="EVENT">EVENT</option>
                    <option value="RULE_CHANGE">RULE_CHANGE</option>
                    <option value="LOST_FOUND">LOST_FOUND</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valid Until (Expiry) *
                  </label>
                  <input
                    type="date"
                    required
                    min={tomorrowStr}
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notice Content *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write details for your community..."
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
                  icon={Bell}
                >
                  Publish Notice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
