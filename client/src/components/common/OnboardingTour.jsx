import React, { useState, useEffect } from 'react';
import { Buddy } from './Buddy';
import { Button } from './Button';
import {
  Compass,
  BookMarked,
  BookPlus,
  BookHeart,
  KeyRound,
  CheckCircle2,
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

const TOUR_STORAGE_KEY = 'booksbuddy_onboarding_completed';

const TOUR_STEPS = [
  {
    step: 1,
    title: 'Explore Libraries',
    description: 'Find and join trusted community libraries right in your society or neighborhood.',
    buddyState: 'pointing',
    icon: Compass,
    tip: 'Look for libraries in your apartment or locality to borrow books without shipping delays.',
  },
  {
    step: 2,
    title: 'My Shelf & Requests',
    description: 'Track books currently with you, pending handover requests, and waitlist positions in one place.',
    buddyState: 'explaining',
    icon: BookMarked,
    tip: 'Keep tabs on due dates and upcoming physical handovers from your personal dashboard.',
  },
  {
    step: 3,
    title: 'Add a Book',
    description: 'Share a book you have finished reading so your neighbors can enjoy it too.',
    buddyState: 'idle',
    icon: BookPlus,
    tip: 'Books stay safely on your bookshelf at home until a verified neighbor requests them.',
  },
  {
    step: 4,
    title: 'Book Requests',
    description: 'Request available books directly from current holders or join the waiting list for popular titles.',
    buddyState: 'pointing',
    icon: BookHeart,
    tip: 'Fair waiting lists guarantee everyone in the community gets their turn to read.',
  },
  {
    step: 5,
    title: 'Safe Handover',
    description: 'Meet safely in your neighborhood and verify physical transfers using a secure 4-digit PIN.',
    buddyState: 'success',
    icon: KeyRound,
    tip: 'Exact apartment numbers are only revealed once the current holder approves your handover.',
  },
];

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Check if user has already completed or dismissed the onboarding
    try {
      const hasCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!hasCompleted) {
        // Polite delay before showing welcome card so page renders first
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  // Listen for external trigger to restart tour (from Buddy help menu)
  useEffect(() => {
    const handleRestartTour = () => {
      setCurrentStepIndex(0);
      setIsStarted(true);
      setIsCompleted(false);
      setIsOpen(true);
    };

    window.addEventListener('booksbuddy:start-tour', handleRestartTour);
    return () => window.removeEventListener('booksbuddy:start-tour', handleRestartTour);
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    } catch (e) {}
    setIsOpen(false);
  };

  const handleStartTour = () => {
    setIsStarted(true);
    setCurrentStepIndex(0);
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      } catch (e) {}
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const StepIcon = currentStep?.icon || Compass;

  return (
    <aside
      aria-label="BooksBuddy Onboarding Guide"
      className="fixed bottom-6 left-6 z-50 max-w-md w-[calc(100vw-3rem)] sm:w-96 select-none animate-in fade-in-0 slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      {/* Tour Card */}
      <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] shadow-card-hover p-5 sm:p-6 overflow-hidden relative">
        {/* Subtle decorative top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1B4332] via-[#6B8F71] to-[#C97B63]" />

        {/* Close / Skip button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 rounded-xl text-muted hover:text-charcoal hover:bg-[#F2EDE4] transition-colors"
          title="Skip tour"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ─── State 1: Initial Welcome Prompt ─── */}
        {!isStarted && !isCompleted && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                <Buddy state="welcome" size="sm" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-forest bg-sage-tint px-2 py-0.5 rounded-full border border-sage-border/50">
                  Quick Intro
                </span>
                <h3 className="font-serif text-lg font-bold text-charcoal mt-1">
                  Hi! I'm Buddy 🐿️
                </h3>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Welcome to <strong>BooksBuddy</strong>! I can give you a quick 60-second tour of how
              our community libraries work.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartTour}
                className="flex-1"
                icon={Sparkles}
              >
                Show me around
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-muted"
              >
                Skip
              </Button>
            </div>
          </div>
        )}

        {/* ─── State 2: Guided Steps (1 to 5) ─── */}
        {isStarted && !isCompleted && (
          <div className="space-y-4 pt-1">
            {/* Step Counter & Progress bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted mb-1.5">
                <span className="text-forest font-bold">
                  Step {currentStep.step} of {TOUR_STEPS.length}
                </span>
                <span>{Math.round(((currentStepIndex + 1) / TOUR_STEPS.length) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#E7D7C1]/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-forest transition-all duration-300"
                  style={{ width: `${((currentStepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Step Content */}
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <Buddy state={currentStep.buddyState} size="sm" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <StepIcon className="w-4 h-4 text-forest shrink-0" />
                  <h4 className="font-serif text-base font-bold text-charcoal">
                    {currentStep.title}
                  </h4>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {currentStep.description}
                </p>
              </div>
            </div>

            {/* Practical Tip Card */}
            <div className="p-2.5 rounded-2xl bg-sage-tint/60 border border-sage-border/50 text-[11px] text-[#1B4332] leading-relaxed">
              <strong>Tip:</strong> {currentStep.tip}
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentStepIndex === 0}
                onClick={handleBack}
                icon={ArrowLeft}
                className="text-xs"
              >
                Back
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="text-xs text-muted"
                >
                  Skip tour
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleNext}
                  className="text-xs font-semibold"
                >
                  {currentStepIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── State 3: Completion Message ─── */}
        {isCompleted && (
          <div className="space-y-4 text-center py-2">
            <div className="mx-auto flex justify-center">
              <Buddy state="success" size="md" />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-charcoal">
                You're all set! Happy reading. 📚
              </h3>
              <p className="text-xs text-muted leading-relaxed max-w-xs mx-auto">
                Explore local libraries, request books from neighbors, and enjoy reading within your community.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleDismiss}
              className="w-full"
              icon={CheckCircle2}
            >
              Start Exploring Books
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
