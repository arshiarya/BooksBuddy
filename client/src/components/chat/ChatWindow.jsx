import React, { useState, useEffect, useRef } from 'react';
import { chatApi } from '../../api/chat.api';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/EmptyState';
import { Send, MessageSquare, Radio } from 'lucide-react';

export function ChatWindow({ borrowRequestId, recipientName, bookTitle, className = '' }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    let isMounted = true;
    const socket = getSocket();

    // 1. Fetch initial message history
    (async () => {
      try {
        const res = await chatApi.getMessages(borrowRequestId, { limit: 50 });
        if (isMounted) {
          setMessages(res.messages || []);
          setLoading(false);
          setTimeout(scrollToBottom, 100);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
        if (isMounted) setLoading(false);
      }
    })();

    // 2. Setup Socket.IO real-time connection & room
    if (socket) {
      if (!socket.connected) {
        socket.connect();
      }

      const handleConnect = () => {
        setIsConnected(true);
        socket.emit('join_room', { borrowRequestId });
      };

      const handleDisconnect = () => {
        setIsConnected(false);
      };

      const handleReceiveMessage = (msg) => {
        const reqId = msg.borrowRequestId ?? msg.borrow_request_id;
        if (Number(reqId) === Number(borrowRequestId)) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(scrollToBottom, 50);
        }
      };

      if (socket.connected) {
        handleConnect();
      }

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('receive_message', handleReceiveMessage);

      return () => {
        isMounted = false;
        socket.emit('leave_room', { borrowRequestId });
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('receive_message', handleReceiveMessage);
      };
    }
  }, [borrowRequestId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');

    const socket = getSocket();
    let sentViaSocket = false;

    if (socket && socket.connected) {
      socket.emit('send_message', {
        borrowRequestId: Number(borrowRequestId),
        messageText: text,
        content: text,
      });
      sentViaSocket = true;
    }

    try {
      if (!sentViaSocket) {
        const res = await chatApi.postMessage(borrowRequestId, text);
        const msg = res.chatMessage || res.message;
        if (msg) {
          setMessages((prev) => [...prev, msg]);
          setTimeout(scrollToBottom, 50);
        }
      }
    } catch (err) {
      console.error('Failed to send message via HTTP:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] flex flex-col overflow-hidden shadow-card ${className}`}
    >
      {/* Chat Header */}
      <div className="p-4 bg-[#FAF6EE] border-b border-[#E7D7C1] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sage-tint text-forest flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-charcoal">
              Coordinating with {recipientName || 'Neighbor'}
            </h3>
            {bookTitle && (
              <p className="text-[11px] text-muted">
                Book: <strong className="text-charcoal">{bookTitle}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted bg-white px-2.5 py-1 rounded-full border border-[#DDCFC0]">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-forest animate-pulse' : 'bg-muted/50'
            }`}
          />
          {isConnected ? 'Real-time' : 'Connecting'}
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF7F2]/60 min-h-[300px]">
        {loading ? (
          <LoadingSpinner text="Loading messages..." size="sm" />
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-muted text-xs space-y-1">
            <p className="font-bold text-charcoal">No messages yet.</p>
            <p>Coordinate a safe meetup place & time for your physical book handover.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const senderId = msg.senderId ?? msg.sender_id;
            const isMe = Number(senderId) === Number(user?.id);
            const senderName = msg.senderName || msg.sender_name || (isMe ? 'You' : recipientName || 'Member');
            const contentText = msg.messageText || msg.message_text || msg.content;
            const timeStr = msg.createdAt || msg.created_at;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-bold text-charcoal">
                    {isMe ? 'You' : senderName}
                  </span>
                  <span className="text-[9px] text-muted">
                    {timeStr
                      ? new Date(timeStr).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                    isMe
                      ? 'bg-forest text-ivory rounded-br-xs font-medium'
                      : 'bg-white text-charcoal border border-[#DDCFC0] rounded-bl-xs'
                  }`}
                >
                  {contentText}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <form onSubmit={handleSendMessage} className="p-3 bg-[#FDFBF7] border-t border-[#E7D7C1] flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message to coordinate meetup..."
          className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
          disabled={sending}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!inputText.trim() || sending}
          loading={sending}
          icon={Send}
          className="font-bold px-4"
        >
          Send
        </Button>
      </form>
    </div>
  );
}
