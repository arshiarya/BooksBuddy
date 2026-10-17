import React, { useState, useEffect } from 'react';
import { borrowingApi } from '../api/borrowing.api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { BorrowStatusBadge } from '../components/borrowing/BorrowStatusBadge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  BookMarked,
  KeyRound,
  MessageSquare,
  Clock,
  ArrowRight,
  BookOpen,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export function MyBooksDashboardScreen() {
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [data, setData] = useState({
    asBorrower: [],
    asCustodian: [],
    inCustody: [],
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      const res = await borrowingApi.getMyRequests();
      setData(res);
    } catch (err) {
      showToast(err.message || 'Failed to load your borrowing dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (requestId) => {
    setActionLoading(true);
    try {
      await borrowingApi.approveRequest(requestId);
      showToast('Borrow request approved! Handover session active.', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to approve request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async (requestId) => {
    if (!window.confirm('Decline this borrow request?')) return;
    setActionLoading(true);
    try {
      await borrowingApi.declineRequest(requestId);
      showToast('Borrow request declined.', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to decline request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (requestId) => {
    if (!window.confirm('Cancel your borrow request?')) return;
    setActionLoading(true);
    try {
      await borrowingApi.cancelRequest(requestId);
      showToast('Borrow request cancelled.', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to cancel request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading your shelf and requests..." />;
  }

  const pendingCustodianActions = data.asCustodian.filter((r) =>
    ['CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING'].includes(r.status)
  );

  return (
    <div className="space-y-8 py-2 max-w-6xl mx-auto">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal tracking-tight">
          My Shelf & Requests
        </h1>
        <p className="text-xs text-muted mt-1">
          Manage your active borrowed books, waiting list status, and physical book handovers.
        </p>
      </div>

      {/* ─── Section 1: Urgent Incoming Action Requests ─── */}
      {pendingCustodianActions.length > 0 && (
        <div className="bg-[#FAF4ED] rounded-3xl border border-[#E7C8AA] p-6 space-y-4 shadow-card">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-gold shrink-0" />
            <h2 className="text-xs font-bold text-[#8C5D23] uppercase tracking-wider">
              Handover Requests Requiring Your Action
            </h2>
          </div>

          <div className="divide-y divide-[#E7D7C1]/80">
            {pendingCustodianActions.map((item) => (
              <div
                key={item.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <h3 className="font-serif text-sm font-bold text-charcoal">{item.book_title}</h3>
                  <p className="text-xs text-muted">
                    Requested by <strong className="text-charcoal">{item.borrower_name}</strong> in {item.library_name}
                  </p>
                  <p className="text-[11px] text-muted">
                    Status: <strong className="text-forest">{item.status}</strong> &bull; Requested on{' '}
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {item.status === 'CUSTODIAN_APPROVAL_PENDING' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(item.id)}
                        loading={actionLoading}
                        className="font-bold"
                      >
                        Approve Handover
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDecline(item.id)}
                        loading={actionLoading}
                        className="text-rose-700 hover:bg-rose-50 border-rose-200"
                      >
                        Decline
                      </Button>
                    </>
                  )}

                  {item.status === 'HANDOVER_PENDING' && item.handover_session_id && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/handover/${item.handover_session_id}`)}
                        icon={KeyRound}
                        className="font-bold"
                      >
                        Open Handover PIN & Condition
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/chat/${item.id}`)}
                        icon={MessageSquare}
                        className="font-semibold"
                      >
                        Chat
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Section 2: Currently With Me & My Requests ─── */}
      <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 sm:p-7 space-y-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-charcoal flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-forest" />
            Currently With Me & My Requests
          </h2>
          <span className="text-xs text-muted font-semibold">
            {data.asBorrower.length} total
          </span>
        </div>

        {data.asBorrower.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="No active requests"
            description="You haven't requested any books yet. Explore your neighborhood catalogue!"
            actionText="Explore Libraries"
            onAction={() => navigate('/')}
          />
        ) : (
          <div className="divide-y divide-[#E7D7C1]">
            {data.asBorrower.map((req) => {
              const isHandoverReady = req.status === 'HANDOVER_PENDING' && req.handover_session_id;

              return (
                <div
                  key={req.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        onClick={() => navigate(`/library/${req.library_id}/book/${req.book_id}`)}
                        className="font-serif text-sm font-bold text-charcoal hover:text-forest cursor-pointer transition-colors"
                      >
                        {req.book_title}
                      </h3>
                      <BorrowStatusBadge status={req.status} queuePosition={req.queue_position} size="sm" />
                    </div>

                    <p className="text-xs text-muted">
                      by {req.book_author} &bull; Library: {req.library_name}
                    </p>

                    {req.due_date && req.status === 'ACTIVE' && (
                      <p className="text-[11px] text-forest font-semibold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Due Date: {new Date(req.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {isHandoverReady && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/handover/${req.handover_session_id}`)}
                        icon={KeyRound}
                        className="font-bold"
                      >
                        Verify Handover
                      </Button>
                    )}

                    {['HANDOVER_PENDING', 'ACTIVE'].includes(req.status) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/chat/${req.id}`)}
                        icon={MessageSquare}
                        className="font-semibold"
                      >
                        Chat
                      </Button>
                    )}

                    {['QUEUED', 'CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING'].includes(req.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(req.id)}
                        loading={actionLoading}
                        className="text-muted hover:text-rose-700 hover:bg-rose-50"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Section 3: Books in Your Custody ─── */}
      <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 sm:p-7 space-y-4 shadow-card">
        <h2 className="font-serif text-lg font-bold text-charcoal flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-forest" />
          Books in Your Physical Custody
        </h2>
        <p className="text-xs text-muted">
          Books you have donated or borrowed that currently sit on your physical shelf.
        </p>

        {data.inCustody.length === 0 ? (
          <p className="text-xs text-muted/70 italic py-2">
            You currently hold no books on your physical shelf.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {data.inCustody.map((book) => (
              <div
                key={book.id}
                onClick={() => navigate(`/library/${book.library_id}/book/${book.id}`)}
                className="p-4 rounded-2xl bg-[#FAF6EE] border border-[#E7D7C1] hover:border-forest/40 hover:shadow-xs cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-serif text-sm font-bold text-charcoal line-clamp-1">{book.title}</h4>
                  <Badge variant="primary" size="sm">
                    {book.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted line-clamp-1">by {book.author}</p>
                <div className="text-[11px] text-muted flex items-center justify-between pt-1 border-t border-[#E7D7C1]">
                  <span>Condition: {book.condition || 'GOOD'}</span>
                  <span className="text-forest font-semibold flex items-center gap-1">
                    View <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
