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
    contact_info: user?.email || user?.phone || 'Community Member',
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
      const payload = {
        title: formData.title.trim(),
        description: (formData.content || formData.description || '').trim(),
        category: formData.category || 'GENERAL',
        priority: formData.priority || 'NORMAL',
        contact_info: (formData.contact_info || user?.email || user?.phone || 'Community Member').trim(),
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : tomorrowStr,
      };
      await communityApi.createNotice(libraryId, payload);
      showToast('Community notice published successfully.', 'success');
      setFormData({
        title: '',
        content: '',
        category: 'GENERAL',
        priority: 'NORMAL',
        contact_info: user?.email || user?.phone || 'Community Member',
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FDFBF7] p-4 sm:p-5 rounded-3xl border border-[#DDCFC0] shadow-card">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 ${
                category === cat
                  ? 'bg-forest text-ivory shadow-xs'
                  : 'bg-[#F2EDE4] text-charcoal hover:bg-[#E7D7C1]'
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
          className="font-bold"
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
            const isAuthor = Number(notice.author_id) === Number(user?.id);
            const canDelete = isAuthor || isLibrarian;

            return (
              <div
                key={notice.id}
                className="bg-[#FDFBF7] p-5 sm:p-6 rounded-3xl border border-[#DDCFC0] shadow-card flex flex-col justify-between gap-4 hover:border-forest/40 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-serif text-base font-bold text-charcoal leading-tight">
                      {notice.title}
                    </h4>
                    <Badge variant={categoryBadgeVariant[notice.category] || 'neutral'} size="sm">
                      {notice.category}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted leading-relaxed whitespace-pre-line bg-[#FAF6EE] p-3 rounded-2xl border border-[#E7D7C1]">
                    {notice.description || notice.content}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E7D7C1] flex items-center justify-between text-[11px] text-muted">
                  <div className="space-y-0.5">
                    <p className="font-bold text-charcoal">
                      Posted by {notice.author_name || 'Member'}
                    </p>
                    <p className="flex items-center gap-1 text-[10px]">
                      <Calendar className="w-3 h-3" />
                      Valid until {new Date(notice.expires_at).toLocaleDateString()}
                    </p>
                  </div>

                  {canDelete && (
                    <button
                      onClick={() => handleDeleteNotice(notice.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-rose-700 hover:bg-rose-50 transition-colors"
                      title="Delete my notice"
                      aria-label="Delete my notice"
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

      {/* Create Notice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F291E]/50 backdrop-blur-xs">
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-4 animate-in fade-in-0 zoom-in-95">
            <h3 className="font-serif text-lg font-bold text-charcoal">Publish Community Notice</h3>
            <p className="text-xs text-muted">
              Share updates, reading club meetups, book return reminders, or rule changes with your library.
            </p>

            <form onSubmit={handleCreateNotice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Notice Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Weekend Book Swap & Reading Circle"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal font-semibold"
                  >
                    <option value="GENERAL">GENERAL</option>
                    <option value="EVENT">EVENT</option>
                    {isLibrarian && <option value="RULE_CHANGE">RULE_CHANGE</option>}
                    <option value="LOST_FOUND">LOST_FOUND</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">
                    Valid Until (Expiry) *
                  </label>
                  <input
                    type="date"
                    required
                    min={tomorrowStr}
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Notice Content *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write details for your community..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Contact Information (Optional)
                </label>
                <input
                  type="text"
                  value={formData.contact_info}
                  onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                  placeholder="e.g. Email, phone, or flat number"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7D7C1]">
                <Button
                  variant="ghost"
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
                  className="font-bold"
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
