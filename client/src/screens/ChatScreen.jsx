import React, { useState, useEffect } from 'react';
import { borrowingApi } from '../api/borrowing.api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { ChatWindow } from '../components/chat/ChatWindow';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';
import { ArrowLeft, MessageSquare, KeyRound } from 'lucide-react';

export function ChatScreen({ requestId }) {
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await borrowingApi.getRequest(requestId);
        setRequest(res.request);
      } catch (err) {
        showToast(err.message || 'Failed to load request coordination.', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  if (loading) {
    return <LoadingSpinner text="Loading coordination chat..." />;
  }

  if (!request) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Chat not available"
        description="This borrowing request was not found or you are not authorized to access this conversation."
        actionText="Back to My Books"
        onAction={() => navigate('/my-books')}
      />
    );
  }

  const isBorrower = request.borrower_id === user?.id;
  const otherPartyName = isBorrower ? request.custodian_name : request.borrower_name;

  return (
    <div className="max-w-3xl mx-auto py-4 px-4 space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/my-books')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-forest transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Shelf & Requests
        </button>

        {request.handover_session?.id && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/handover/${request.handover_session.id}`)}
            icon={KeyRound}
            className="font-bold"
          >
            Handover Verification
          </Button>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <ChatWindow
          borrowRequestId={requestId}
          recipientName={otherPartyName}
          bookTitle={request.book_title}
          className="flex-1"
        />
      </div>
    </div>
  );
}
