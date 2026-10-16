import React, { useState, useEffect } from 'react';
import { booksApi } from '../api/books.api';
import { borrowingApi } from '../api/borrowing.api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { RemoveBookModal } from '../components/catalogue/RemoveBookModal';
import {
  Book,
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Shield,
  Trash2,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MessageSquare,
  KeyRound,
  History,
} from 'lucide-react';

export function BookDetailScreen({ libraryId, bookId }) {
  const { user, isMemberOf, isLibrarianOf } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const isMember = isMemberOf(libraryId);
  const isLibrarian = isLibrarianOf(libraryId);

  const [book, setBook] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Librarian book removal modal
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const loadBookAndRequests = async () => {
    try {
      const bRes = await booksApi.getById(bookId);
      setBook(bRes.book);

      if (user && isMember) {
        try {
          const rRes = await borrowingApi.listBookRequests(bookId);
          setRequests(rRes.requests || []);
        } catch (e) {
          // If not permitted to list all requests, continue
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to load book details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookAndRequests();
  }, [bookId]);

  if (loading) {
    return <LoadingSpinner text="Loading book details..." />;
  }

  if (!book) {
    return (
      <EmptyState
        icon={Book}
        title="Book not found"
        description="This book could not be found in the library catalogue."
        actionText="Back to Catalogue"
        onAction={() => navigate(`/library/${libraryId}`)}
      />
    );
  }

  const isCustodian = book.current_custodian_id === user?.id;
  const myActiveRequest = requests.find(
    (r) =>
      r.borrower_id === user?.id &&
      ['QUEUED', 'CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING', 'ACTIVE'].includes(r.status)
  );

  // Handle Borrow / Join Waitlist
  const handleBorrowRequest = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isMember) {
      showToast('You must be an approved member of this library to borrow books.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await borrowingApi.createRequest(book.id);
      showToast(res.message, 'success');
      loadBookAndRequests();
    } catch (err) {
      showToast(err.message || 'Failed to request book.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Request
  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel your borrow request?')) return;

    setActionLoading(true);
    try {
      await borrowingApi.cancelRequest(requestId);
      showToast('Borrow request cancelled.', 'success');
      loadBookAndRequests();
    } catch (err) {
      showToast(err.message || 'Failed to cancel request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Custodian Approve
  const handleApprove = async (requestId) => {
    setActionLoading(true);
    try {
      const res = await borrowingApi.approveRequest(requestId);
      showToast('Request approved! Handover session initiated.', 'success');
      loadBookAndRequests();
    } catch (err) {
      showToast(err.message || 'Failed to approve request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Custodian Decline
  const handleDecline = async (requestId) => {
    if (!window.confirm('Decline this borrow request? Queue will advance to the next member.')) return;

    setActionLoading(true);
    try {
      await borrowingApi.declineRequest(requestId);
      showToast('Borrow request declined.', 'success');
      loadBookAndRequests();
    } catch (err) {
      showToast(err.message || 'Failed to decline request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Custodian Early Release
  const handleEarlyRelease = async () => {
    if (!window.confirm('Ready to pass this book to the next waiting member? A new handover session will be generated.')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await borrowingApi.earlyRelease(book.id);
      showToast(res.message, 'success');
      loadBookAndRequests();
    } catch (err) {
      showToast(err.message || 'Failed to initiate early release.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const statusVariant = {
    AVAILABLE: 'success',
    BORROWED: 'warning',
    RESERVED: 'info',
    REMOVED: 'danger',
  }[book.status] || 'neutral';

  const conditionVariant = {
    NEW: 'success',
    GOOD: 'primary',
    FAIR: 'warning',
    DAMAGED: 'danger',
  }[book.condition] || 'neutral';

  return (
    <div className="space-y-6 py-4 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(`/library/${libraryId}`)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Library Catalogue
      </button>

      {/* Main Book Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row gap-8">
        {/* Cover column */}
        <div className="w-full md:w-64 shrink-0 flex flex-col items-center">
          <div className="relative aspect-[3/4] w-full max-w-[240px] rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shadow-xs flex items-center justify-center">
            {book.cover_image_url ? (
              <img
                src={book.cover_image_url}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <Book className="w-16 h-16 mx-auto mb-2 text-slate-300" />
                <span className="text-xs font-bold text-slate-500">{book.title}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col items-center gap-2">
            <Badge variant={statusVariant} size="lg">
              {book.status}
            </Badge>
            {book.condition && (
              <Badge variant={conditionVariant} size="sm">
                Condition: {book.condition}
              </Badge>
            )}
          </div>
        </div>

        {/* Info Column */}
        <div className="flex-1 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {book.title}
            </h1>
            <p className="text-sm font-semibold text-slate-600">by {book.author}</p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
              {book.genre && (
                <span className="bg-slate-100 px-3 py-1 rounded-lg font-medium">
                  {book.genre}
                </span>
              )}
              {book.isbn && (
                <span className="bg-slate-100 px-3 py-1 rounded-lg font-mono">
                  ISBN: {book.isbn}
                </span>
              )}
              <span className="bg-slate-100 px-3 py-1 rounded-lg">
                Added {new Date(book.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {book.description && (
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Description & Condition Notes
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                {book.description}
              </p>
            </div>
          )}

          {/* Decentralized Physical Custody Details (Privacy-Safe) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-brand-600" />
              Physical Custody & Location
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
              <div>
                <span className="text-slate-400">Current Custodian: </span>
                <strong>{isCustodian ? 'You (Current Custodian)' : book.custodian_name || 'Community Member'}</strong>
              </div>
              <div>
                <span className="text-slate-400">Pickup Area: </span>
                <strong>{book.custodian_locality || book.society_locality || 'Neighborhood'}</strong>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 italic pt-1">
              Exact pickup address will be revealed to the approved borrower at the handover stage.
            </p>
          </div>

          {/* Donor Attribution */}
          {book.donor_name && (
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Generously donated to the community by <strong>{book.donor_name}</strong>.</span>
            </div>
          )}

          {/* Borrowing / Handover CTAs */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            {/* If user is the borrower with an active/pending request */}
            {myActiveRequest ? (
              <div className="p-5 rounded-2xl bg-brand-50/80 border border-brand-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                    Your Borrowing Request Status
                  </span>
                  <Badge variant="primary" size="sm">
                    {myActiveRequest.status}
                  </Badge>
                </div>

                <p className="text-xs text-brand-800">
                  {myActiveRequest.status === 'CUSTODIAN_APPROVAL_PENDING' &&
                    'Waiting for the current custodian to approve the handover.'}
                  {myActiveRequest.status === 'QUEUED' &&
                    `You are in the waiting queue. Position: #${myActiveRequest.queue_position || 1}.`}
                  {myActiveRequest.status === 'HANDOVER_PENDING' &&
                    'Request approved! Coordinate physical handover with the custodian.'}
                  {myActiveRequest.status === 'ACTIVE' &&
                    'You currently have this book borrowed.'}
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  {myActiveRequest.status === 'HANDOVER_PENDING' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate('/my-books')}
                      icon={KeyRound}
                    >
                      Open Handover Verification
                    </Button>
                  )}

                  {['QUEUED', 'CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING'].includes(
                    myActiveRequest.status
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelRequest(myActiveRequest.id)}
                      loading={actionLoading}
                      className="text-rose-600 hover:bg-rose-50 border-rose-200"
                    >
                      Cancel Request
                    </Button>
                  )}
                </div>
              </div>
            ) : isCustodian ? (
              /* If user is the current custodian */
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    You have physical custody of this book
                  </span>
                  <Badge variant="primary" size="sm">
                    In Your Possession
                  </Badge>
                </div>

                {book.status === 'BORROWED' && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Finished reading early? Release this book to immediately advance the waiting queue
                      and pass it to the next neighbor.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleEarlyRelease}
                      loading={actionLoading}
                    >
                      Initiate Early Release
                    </Button>
                  </div>
                )}
              </div>
            ) : book.status === 'AVAILABLE' ? (
              /* Book available for borrowing */
              <Button
                variant="primary"
                size="lg"
                onClick={handleBorrowRequest}
                loading={actionLoading}
                className="w-full sm:w-auto"
                icon={Book}
              >
                Request to Borrow Book
              </Button>
            ) : book.status === 'BORROWED' || book.status === 'RESERVED' ? (
              /* Book currently borrowed: Join Waitlist (FIFO queue) */
              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleBorrowRequest}
                  loading={actionLoading}
                  className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 focus:ring-purple-500 shadow-purple-500/20"
                  icon={Clock}
                >
                  Join Waitlist (FIFO Queue)
                </Button>
                <p className="text-[11px] text-slate-500">
                  When the current loan finishes or an early release is initiated, the queue promotes the
                  earliest queued member automatically.
                </p>
              </div>
            ) : null}

            {/* Librarian Moderation Controls */}
            {isLibrarian && book.status !== 'REMOVED' && (
              <div className="pt-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRemoveModal(true)}
                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  icon={Trash2}
                >
                  Remove Book from Catalogue
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custodian Pending Approval Requests Section (For Custodian) */}
      {isCustodian && requests.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" />
            Borrowing Requests Awaiting Your Handover
          </h3>

          <div className="divide-y divide-slate-100">
            {requests
              .filter((r) => ['CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING'].includes(r.status))
              .map((r) => (
                <div
                  key={r.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      Borrower: {r.borrower_name || `Member #${r.borrower_id}`}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Status: <strong className="text-brand-700">{r.status}</strong> &bull; Requested on{' '}
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {r.status === 'CUSTODIAN_APPROVAL_PENDING' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprove(r.id)}
                          loading={actionLoading}
                        >
                          Approve Handover
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDecline(r.id)}
                          loading={actionLoading}
                          className="text-rose-600 hover:bg-rose-50"
                        >
                          Decline
                        </Button>
                      </>
                    )}

                    {r.status === 'HANDOVER_PENDING' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/my-books')}
                        icon={KeyRound}
                      >
                        Complete Handover
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Custody History Audit Log */}
      {book.custody_history && book.custody_history.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-brand-600" />
            Custody Audit Chain
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {book.custody_history.map((hist, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-slate-600">
                <div>
                  <span className="font-semibold text-slate-900">{hist.action}</span>
                  <span className="text-slate-400"> &bull; </span>
                  <span>Custodian: {hist.custodian_name || 'Member'}</span>
                  {hist.notes && <span className="text-slate-400 italic"> ({hist.notes})</span>}
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  {new Date(hist.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remove Book Modal */}
      <RemoveBookModal
        isOpen={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
        book={book}
        onSuccess={() => navigate(`/library/${libraryId}`)}
      />
    </div>
  );
}
