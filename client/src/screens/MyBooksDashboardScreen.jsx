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
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
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
    <div className="space-y-8 py-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          My Shelf & Borrowing
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your active borrowed books, waitlist queue status, and physical book handovers.
        </p>
      </div>

      {/* Section 1: Urgent Incoming Custodian Action Requests */}
      {pendingCustodianActions.length > 0 && (
        <div className="bg-amber-50/80 rounded-3xl border border-amber-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <h2 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
              Handover Requests Requiring Your Action
            </h2>
          </div>

          <div className="divide-y divide-amber-200/60">
            {pendingCustodianActions.map((item) => (
              <div
                key={item.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">{item.book_title}</h3>
                  <p className="text-xs text-slate-600">
                    Requested by <strong>{item.borrower_name}</strong> in {item.library_name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Status: <strong className="text-amber-800">{item.status}</strong> &bull; Requested on{' '}
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
                      >
                        Approve Handover
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDecline(item.id)}
                        loading={actionLoading}
                        className="text-rose-600 hover:bg-rose-50"
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
                      >
                        Open Handover PIN & Condition
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/chat/${item.id}`)}
                        icon={MessageSquare}
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

      {/* Section 2: My Borrow Requests & Active Loans */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-brand-600" />
            My Borrow Requests & Active Loans
          </h2>
          <span className="text-xs text-slate-400">
            {data.asBorrower.length} total
          </span>
        </div>

        {data.asBorrower.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="No active borrowing requests"
            description="You haven't requested any books yet. Explore your neighborhood catalogue!"
            actionText="Browse Libraries"
            onAction={() => navigate('/')}
          />
        ) : (
          <div className="divide-y divide-slate-100">
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
                        className="text-sm font-bold text-slate-900 hover:text-brand-600 cursor-pointer transition-colors"
                      >
                        {req.book_title}
                      </h3>
                      <BorrowStatusBadge status={req.status} queuePosition={req.queue_position} size="sm" />
                    </div>

                    <p className="text-xs text-slate-500">
                      by {req.book_author} &bull; Library: {req.library_name}
                    </p>

                    {req.due_date && req.status === 'ACTIVE' && (
                      <p className="text-[11px] text-emerald-700 font-medium">
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
                      >
                        Verify Handover
                      </Button>
                    )}

                    {['HANDOVER_PENDING', 'ACTIVE'].includes(req.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/chat/${req.id}`)}
                        icon={MessageSquare}
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
                        className="text-slate-400 hover:text-rose-600"
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

      {/* Section 3: Books in My Physical Possession */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-600" />
            Books Currently in My Physical Custody
          </h2>
          <span className="text-xs text-slate-400">
            {data.inCustody.length} on your shelf
          </span>
        </div>

        {data.inCustody.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No books currently in your custody"
            description="Books you donate or borrow will appear here while they rest on your personal bookshelf."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {data.inCustody.map((book) => (
              <div
                key={book.id}
                onClick={() => navigate(`/library/${book.library_id}/book/${book.id}`)}
                className="p-4 rounded-2xl border border-slate-200 hover:border-brand-400 cursor-pointer transition-all hover:shadow-xs space-y-2 bg-slate-50/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{book.title}</h4>
                  <Badge variant={book.status === 'AVAILABLE' ? 'success' : 'warning'} size="sm">
                    {book.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">by {book.author}</p>
                <p className="text-[11px] text-slate-400 truncate">Library: {book.library_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
