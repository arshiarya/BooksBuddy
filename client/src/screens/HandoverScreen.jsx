import React, { useState, useEffect } from 'react';
import { borrowingApi } from '../api/borrowing.api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { getSocket } from '../services/socket';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { PinDisplay } from '../components/borrowing/PinDisplay';
import { PinEntry } from '../components/borrowing/PinEntry';
import { ConditionForm } from '../components/borrowing/ConditionForm';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  KeyRound,
  ShieldCheck,
  MapPin,
  Phone,
  User,
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';

export function HandoverScreen({ sessionId }) {
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    try {
      const res = await borrowingApi.getHandover(sessionId);
      setSession(res.handoverSession);
      const socket = getSocket();
      if (socket && res.handoverSession?.borrow_request_id) {
        socket.emit('join_room', { borrowRequestId: res.handoverSession.borrow_request_id });
      }
    } catch (err) {
      showToast(err.message || 'Failed to load book handover.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();

    // Setup Socket.IO listener for real-time status updates
    const socket = getSocket();
    if (socket) {
      const handleStatusChange = (data) => {
        showToast(`Handover updated: ${data.status || data.eventType}`, 'info');
        loadSession();
      };

      socket.on('handover_status_changed', handleStatusChange);
      return () => {
        socket.off('handover_status_changed', handleStatusChange);
      };
    }
  }, [sessionId]);

  if (loading) {
    return <LoadingSpinner text="Loading book handover details..." />;
  }

  if (!session) {
    return (
      <EmptyState
        icon={KeyRound}
        title="Book handover not found"
        description="This handover may have expired, completed, or you are not authorized to view it."
        actionText="Back to My Books"
        onAction={() => navigate('/my-books')}
      />
    );
  }

  const isGiver = Number(session.giver_user_id) === Number(user?.id);
  const isReceiver = Number(session.receiver_user_id) === Number(user?.id);
  const isCompleted =
    Boolean(session.giver_confirmed_at && session.receiver_confirmed_at) ||
    session.status === 'COMPLETED' ||
    session.borrow_status === 'ACTIVE';

  let localPin = null;
  try {
    if (isCompleted) {
      sessionStorage.removeItem(`bb_handover_pin_${session.id}`);
    } else {
      localPin = isGiver ? sessionStorage.getItem(`bb_handover_pin_${session.id}`) : null;
    }
  } catch (e) {}
  const displayPin = session.pin || localPin;

  return (
    <div className="max-w-3xl mx-auto py-4 px-4 space-y-6">
      <button
        onClick={() => navigate('/my-books')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-forest transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to My Shelf & Requests
      </button>

      {/* Main Header */}
      <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 sm:p-8 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-sage-tint text-forest flex items-center justify-center font-bold border border-sage-border/60">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-xl sm:text-2xl font-bold text-charcoal tracking-tight">
                  Handover Verification
                </h1>
                <Badge variant={isCompleted ? 'success' : 'info'} size="sm">
                  {isCompleted ? 'COMPLETED' : session.status}
                </Badge>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Book: <strong className="text-charcoal">{session.book_title}</strong>
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/chat/${session.borrow_request_id}`)}
            icon={MessageSquare}
            className="font-semibold"
          >
            Open Chat
          </Button>
        </div>

        {/* Success Completion Banner */}
        {isCompleted && (
          <div className="p-4 rounded-2xl bg-sage-tint border border-sage-border text-forest space-y-1">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-forest">
              <CheckCircle2 className="w-5 h-5 text-forest shrink-0" />
              Handover & Custody Transfer Complete!
            </div>
            <p className="text-xs text-forest/90 leading-relaxed">
              Both parties verified the one-time PIN and confirmed the physical book condition. The
              borrowing request is now officially <strong>ACTIVE</strong>.
            </p>
          </div>
        )}

        {/* Authorized Address Reveal (Shown to borrower during active handover) */}
        {isReceiver && (session.pickup_address || session.giver_address) && (
          <div className="p-4 rounded-2xl bg-[#FAF4ED] border border-[#E7C8AA] text-[#8C5D23] space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#8C5D23]">
              <ShieldCheck className="w-4 h-4 text-forest shrink-0" />
              Authorized Pickup Address & Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted font-medium">Pickup Location: </span>
                <strong className="text-charcoal font-bold">
                  {session.pickup_address?.flat_house_number || session.giver_address},{' '}
                  {session.pickup_address?.society_locality || session.giver_locality}
                  {(session.pickup_address?.city || session.giver_city)
                    ? `, ${session.pickup_address?.city || session.giver_city}`
                    : ''}
                </strong>
              </div>
              {(session.pickup_address?.phone || session.giver_phone) && (
                <div>
                  <span className="text-muted font-medium">Contact Phone: </span>
                  <strong className="text-charcoal font-mono">
                    {session.pickup_address?.phone || session.giver_phone}
                  </strong>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted italic pt-1">
              Protected address revealed exclusively to you as the authorized receiver for this handover.
            </p>
          </div>
        )}

        {/* Handover Window Expiry Reminder */}
        {session.expires_at && !isCompleted && (
          <div className="flex items-center gap-2 text-xs text-muted bg-[#FAF6EE] p-3 rounded-xl border border-[#E7D7C1]">
            <Clock className="w-4 h-4 text-gold shrink-0" />
            <span>
              Handover window expires on:{' '}
              <strong className="text-charcoal">{new Date(session.expires_at).toLocaleString()}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Two-Sided Verification Panels */}
      <div className="space-y-6">
        {/* Step 1: 4-Digit Security PIN */}
        {isGiver ? (
          <PinDisplay pin={displayPin} verifiedAt={session.verified_at} />
        ) : isReceiver ? (
          <PinEntry
            sessionId={session.id}
            verifiedAt={session.verified_at}
            attemptsLeft={session.attempts_left}
            onSuccess={loadSession}
          />
        ) : null}

        {/* Step 2: Two-Sided Condition Confirmation */}
        <ConditionForm
          sessionId={session.id}
          isGiver={isGiver}
          isReceiver={isReceiver}
          giverConfirmedAt={session.giver_confirmed_at}
          receiverConfirmedAt={session.receiver_confirmed_at}
          giverCondition={session.giver_condition_rating}
          receiverCondition={session.receiver_condition_rating}
          onSuccess={loadSession}
        />
      </div>
    </div>
  );
}
