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
    <div className="space-y-6 py-2 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(`/library/${libraryId}`)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-forest transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Library Catalogue
      </button>

      {/* Main Book Card */}
      <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 sm:p-8 shadow-card flex flex-col md:flex-row gap-8">
        {/* Cover column */}
        <div className="w-full md:w-64 shrink-0 flex flex-col items-center">
          <div className="relative aspect-[3/4] w-full max-w-[240px] rounded-2xl bg-[#F4ECE1] border border-[#E7D7C1] overflow-hidden shadow-xs flex items-center justify-center">
            {book.cover_image_url ? (
              <img
                src={book.cover_image_url}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6 text-muted/60">
                <Book className="w-16 h-16 mx-auto mb-2 text-forest/40" />
                <span className="font-serif text-xs font-bold text-charcoal">{book.title}</span>
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
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal tracking-tight">
              {book.title}
            </h1>
            <p className="text-sm font-semibold text-muted">by {book.author}</p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted">
              {book.genre && (
                <span className="bg-[#F2EDE4] px-3 py-1 rounded-lg font-semibold text-charcoal border border-[#E7D7C1]">
                  {book.genre}
                </span>
              )}
              {book.isbn && (
                <span className="bg-[#F2EDE4] px-3 py-1 rounded-lg font-mono text-muted border border-[#E7D7C1]">
                  ISBN: {book.isbn}
                </span>
              )}
              <span className="bg-[#F2EDE4] px-3 py-1 rounded-lg border border-[#E7D7C1]">
                Added {new Date(book.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {book.description && (
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                Description & Condition Notes
              </h3>
              <p className="text-xs text-muted leading-relaxed whitespace-pre-line bg-[#FAF6EE] p-3.5 rounded-2xl border border-[#E7D7C1]">
                {book.description}
              </p>
            </div>
          )}

          {/* Decentralized Physical Custody Details (Privacy-Safe) */}
          <div className="p-4 rounded-2xl bg-[#FAF6EE] border border-[#E7D7C1] space-y-2 text-xs">
            <h4 className="font-bold text-charcoal flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-forest" />
              Physical Custody & Location
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted">
              <div>
                <span className="text-muted/70">Current Holder (Custodian): </span>
                <strong className="text-charcoal">{isCustodian ? 'You (Current Custodian)' : book.current_custodian_name || book.custodian_name || 'Community Member'}</strong>
              </div>
              <div>
                <span className="text-muted/70">Pickup Area: </span>
                <strong className="text-charcoal">{book.current_custodian_locality || book.custodian_locality || book.library_locality || book.society_locality || 'Neighborhood'}</strong>
              </div>
            </div>
            <p className="text-[11px] text-muted italic pt-1">
              Exact pickup address will be revealed to the approved borrower at the handover stage.
            </p>
          </div>

          {/* Donor Attribution */}
          {(book.original_donor_name || book.donor_name) && (
            <div className="text-xs text-muted flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold shrink-0" />
              <span>Generously donated to the community by <strong className="text-charcoal">{book.original_donor_name || book.donor_name}</strong>.</span>
            </div>
          )}

          {/* Borrowing / Handover CTAs */}
          <div className="pt-4 border-t border-[#E7D7C1] space-y-4">
            {/* If user is the borrower with an active/pending request */}
            {myActiveRequest ? (
              <div className="p-5 rounded-2xl bg-sage-tint/60 border border-sage-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-forest uppercase tracking-wider">
                    Your Borrowing Request Status
                  </span>
                  <Badge variant="primary" size="sm">
                    {myActiveRequest.status}
                  </Badge>
                </div>

                <p className="text-xs text-forest">
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
                      className="font-bold"
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
                      className="text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      Cancel Request
                    </Button>
                  )}
                </div>
              </div>
            ) : isCustodian ? (
              /* If user is the current custodian */
              <div className="p-5 rounded-2xl bg-[#FAF6EE] border border-[#E7D7C1] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-charcoal uppercase tracking-wider">
                    You have physical custody of this book
                  </span>
                  <Badge variant="primary" size="sm">
                    In Your Possession
                  </Badge>
                </div>

                {book.status === 'BORROWED' && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted leading-relaxed">
                      Finished reading early? Release this book to immediately advance the waiting queue
                      and pass it to the next neighbor.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleEarlyRelease}
                      loading={actionLoading}
                      className="font-bold"
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
                className="w-full sm:w-auto font-bold px-6"
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
                  className="w-full sm:w-auto font-bold px-6 bg-[#6B8F71] hover:bg-[#5B7C60]"
                  icon={Clock}
                >
                  Join Waitlist (FIFO Queue)
                </Button>
                <p className="text-[11px] text-muted">
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
                  className="text-muted hover:text-rose-700 hover:bg-rose-50"
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
        <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 space-y-4 shadow-card">
          <h3 className="font-serif text-base font-bold text-charcoal flex items-center gap-2">
            <Users className="w-4 h-4 text-forest" />
            Borrowing Requests Awaiting Your Handover
          </h3>

          <div className="divide-y divide-[#E7D7C1]">
            {requests
              .filter((r) => ['CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING'].includes(r.status))
              .map((r) => (
                <div
                  key={r.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-charcoal">
                      Borrower: {r.borrower_name || `Member #${r.borrower_id}`}
                    </p>
                    <p className="text-[11px] text-muted">
                      Status: <strong className="text-forest">{r.status}</strong> &bull; Requested on{' '}
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
                          className="font-bold"
                        >
                          Approve Handover
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDecline(r.id)}
                          loading={actionLoading}
                          className="text-rose-700 hover:bg-rose-50 border-rose-200"
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
                        className="font-bold"
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
        <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 space-y-4 shadow-card">
          <h3 className="font-serif text-base font-bold text-charcoal flex items-center gap-2">
            <History className="w-4 h-4 text-forest" />
            Custody Audit Chain
          </h3>
          <div className="divide-y divide-[#E7D7C1] text-xs">
            {book.custody_history.map((hist, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-muted">
                <div>
                  <span className="font-bold text-charcoal">{hist.action}</span>
                  <span className="text-muted/60"> &bull; </span>
                  <span>Custodian: {hist.custodian_name || 'Member'}</span>
                  {hist.notes && <span className="text-muted/70 italic"> ({hist.notes})</span>}
                </div>
                <span className="text-[11px] text-muted whitespace-nowrap">
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
