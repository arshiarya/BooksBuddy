import React, { useState, useEffect, useRef } from 'react';
import { chatApi } from '../../api/chat.api';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
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
        socket.emit('join_request', { borrowRequestId });
      };

      const handleDisconnect = () => {
        setIsConnected(false);
      };

      const handleReceiveMessage = (msg) => {
        if (Number(msg.borrow_request_id) === Number(borrowRequestId)) {
          setMessages((prev) => {
            // Avoid duplicate message appending
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
        socket.emit('leave_request', { borrowRequestId });
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
        borrowRequestId,
        content: text,
      });
      sentViaSocket = true;
    }

    // If socket wasn't connected, fallback to REST API
    if (!sentViaSocket) {
      try {
        const res = await chatApi.postMessage(borrowRequestId, text);
        setMessages((prev) => [...prev, res.message]);
        setTimeout(scrollToBottom, 50);
      } catch (err) {
        console.error('Failed to send message via REST fallback:', err);
      }
    }

    setSending(false);
  };

  return (
    <div className={`flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 leading-tight">
              {recipientName ? `Chat with ${recipientName}` : 'Handover Coordination'}
            </h4>
            <p className="text-[10px] text-slate-500 truncate max-w-[200px] sm:max-w-xs">
              Regarding: <em>{bookTitle}</em>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">{isConnected ? 'Live' : 'Polling'}</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[240px] max-h-[420px] bg-slate-50/40">
        {loading ? (
          <LoadingSpinner text="Loading messages..." size="sm" />
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            <p className="font-semibold text-slate-600 mb-1">No messages yet.</p>
            <p>Coordinate safe meetup place & time for your book handover.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-semibold text-slate-500">
                    {isMe ? 'You' : msg.sender_name}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-md px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-xs ${
                    isMe
                      ? 'bg-brand-600 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message to coordinate meetup..."
          className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
          disabled={sending}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!inputText.trim() || sending}
          loading={sending}
          icon={Send}
        >
          Send
        </Button>
      </form>
    </div>
  );
}
