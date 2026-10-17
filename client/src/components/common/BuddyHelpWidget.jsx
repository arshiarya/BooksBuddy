import React, { useState, useEffect, useRef } from 'react';
import { Buddy } from './Buddy';
import { Button } from './Button';
import {
  HelpCircle,
  X,
  ChevronDown,
  ChevronRight,
  BookOpen,
  MapPin,
  KeyRound,
  BookPlus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

const HELP_TOPICS = [
  {
    id: 'how-it-works',
    icon: BookOpen,
    title: 'How BooksBuddy works',
    summary: 'A hyperlocal virtual library where residents in the same society share physical books.',
    content:
      'Unlike traditional libraries, books stay on residents’ personal shelves at home until requested. When someone requests a book, the current holder approves it and coordinates a safe in-person handover.',
  },
  {
    id: 'finding-library',
    icon: MapPin,
    title: 'Finding a library',
    summary: 'Discover active libraries established in your society, apartment, or neighborhood.',
    content:
      'Search by society name, locality, or city on the Explore Libraries screen. If your community has a library, request to join. If not, you can create a new community library in minutes.',
  },
  {
    id: 'borrowing',
    icon: HelpCircle,
    title: 'Borrowing a book',
    summary: 'Browse available books or join the waiting list for high-demand titles.',
    content:
      'When you request an available book, the current holder receives a notification. If a book is currently borrowed by someone else, you are placed in a fair waiting list with a visible position.',
  },
  {
    id: 'adding-books',
    icon: BookPlus,
    title: 'Adding a book',
    summary: 'Give books a second life by sharing them with your local community.',
    content:
      'Click "Add a Book" (or "Donate Book") on any library you belong to. Enter title, author, and initial condition. The book stays with you until another neighbor requests it.',
  },
  {
    id: 'handover',
    icon: KeyRound,
    title: 'Safe book handover',
    summary: 'Coordinate meetups safely with one-time 4-digit PIN verification.',
    content:
      'For privacy, exact apartment numbers are only revealed once a handover is approved. When you meet, the giver displays a secret 4-digit PIN. The receiver verifies it, both confirm condition, and custody transfers instantly.',
  },
];

export function BuddyHelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedTopic, setExpandedTopic] = useState('how-it-works');
  const panelRef = useRef(null);

  // Close when clicking outside panel
  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Restart onboarding tour
  const handleRestartTour = () => {
    setIsOpen(false);
    window.dispatchEvent(new Event('booksbuddy:start-tour'));
  };

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-40 select-none">
      {/* ─── Help Popover Panel ─── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Buddy Help Center"
          className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] sm:w-96 bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] shadow-card-hover p-5 sm:p-6 mb-2 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E7D7C1]">
            <div className="flex items-center gap-2.5">
              <Buddy state="floating" size="sm" />
              <div>
                <h3 className="font-serif text-base font-bold text-charcoal">
                  Hi! What can I help with?
                </h3>
                <p className="text-[11px] text-muted">BooksBuddy Community Guide</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-xl text-muted hover:text-charcoal hover:bg-[#F2EDE4] transition-colors"
              aria-label="Close help"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Topics Accordion List */}
          <div className="py-3 space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {HELP_TOPICS.map((topic) => {
              const isExpanded = expandedTopic === topic.id;
              const Icon = topic.icon;

              return (
                <div
                  key={topic.id}
                  className={`rounded-2xl border transition-all ${
                    isExpanded
                      ? 'bg-white border-[#DDCFC0] shadow-xs'
                      : 'bg-[#FAF6EE]/60 border-transparent hover:bg-[#FAF6EE] hover:border-[#DDCFC0]/60'
                  }`}
                >
                  <button
                    onClick={() => setExpandedTopic(isExpanded ? null : topic.id)}
                    className="w-full flex items-center justify-between p-3 text-left gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-sage-tint text-forest flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-charcoal truncate">
                        {topic.title}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-3.5 pb-3 text-[11px] text-muted leading-relaxed border-t border-[#F2EDE4] pt-2">
                      <p>{topic.content}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer with Restart Tour Option */}
          <div className="pt-3 border-t border-[#E7D7C1] flex items-center justify-between">
            <button
              onClick={handleRestartTour}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:text-forest-dark transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-terracotta" />
              Take product tour again
            </button>

            <span className="text-[10px] text-muted">Press Esc to close</span>
          </div>
        </div>
      )}

      {/* ─── Floating Buddy Trigger Button ─── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2 p-1.5 pr-3.5 rounded-full bg-[#FDFBF7] border border-[#DDCFC0] shadow-card hover:shadow-card-hover hover:border-forest/50 transition-all duration-200 active:scale-95"
        title="Ask Buddy for help"
        aria-label="Ask Buddy for help"
      >
        <div className="transition-transform group-hover:scale-110">
          <Buddy state="floating" size="sm" />
        </div>
        <div className="text-left hidden sm:block">
          <span className="block text-xs font-bold text-charcoal group-hover:text-forest transition-colors">
            Ask Buddy
          </span>
          <span className="block text-[10px] text-muted -mt-0.5">Need help?</span>
        </div>
      </button>
    </div>
  );
}
