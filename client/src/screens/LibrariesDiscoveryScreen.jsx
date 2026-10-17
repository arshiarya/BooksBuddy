import React, { useState, useEffect, useRef } from 'react';
import { librariesApi } from '../api/libraries.api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState, LoadingSpinner } from '../components/common/EmptyState';
import {
  Library,
  Search,
  Plus,
  MapPin,
  Users,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Clock,
  Compass,
  BookPlus,
  BookHeart,
  KeyRound,
  Sparkles,
  Star,
  CheckCircle,
} from 'lucide-react';

export function LibrariesDiscoveryScreen() {
  const { user, isMemberOf, getMembership, refreshUser } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedLibraryToJoin, setSelectedLibraryToJoin] = useState(null);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joining, setJoining] = useState(false);

  const [revolvingWordIdx, setRevolvingWordIdx] = useState(0);
  const revolvingWords = ['Neighbors', 'Community', 'Apartment', 'Society'];

  useEffect(() => {
    const timer = setInterval(() => {
      setRevolvingWordIdx((prev) => (prev + 1) % revolvingWords.length);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  const discoverySectionRef = useRef(null);
  const howItWorksSectionRef = useRef(null);

  const loadLibraries = async (query = '') => {
    setLoading(true);
    try {
      const res = await librariesApi.search({ search: query });
      setLibraries(res.libraries || []);
    } catch (err) {
      showToast(err.message || 'Failed to load libraries.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibraries();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadLibraries(searchQuery);
  };

  const scrollToDiscovery = () => {
    discoverySectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToHowItWorks = () => {
    howItWorksSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLibraryToJoin) return;

    if (!user) {
      navigate('/login');
      return;
    }

    setJoining(true);
    try {
      await librariesApi.join(selectedLibraryToJoin.id, inviteCodeInput.trim());
      showToast('Membership application submitted! Awaiting librarian approval.', 'success');
      setSelectedLibraryToJoin(null);
      setInviteCodeInput('');
      await refreshUser();
      loadLibraries(searchQuery);
    } catch (err) {
      showToast(err.message || 'Failed to join library.', 'error');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-12 py-2">
      {/* ─── Hero Section: Animated Value Proposition & Pictorial Showcase ─── */}
      <section className="relative rounded-3xl bg-gradient-to-br from-[#0B2C1E] via-[#134932] to-[#1F6244] text-[#F6F1E7] p-8 sm:p-12 lg:p-14 overflow-hidden shadow-2xl border border-emerald-900/50">
        {/* Subtle decorative background pattern */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#F6F1E7 1.5px, transparent 1.5px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Ambient warm gradient highlights */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Animated Messaging */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/20 text-[#FAF7F2] shadow-xs animate-fade-in-up">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Hyperlocal Community Library Platform</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight text-[#FAF7F2] leading-[1.12] animate-fade-in-up delay-100">
              Borrow Books From Your{' '}
              <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-amber-200 to-emerald-200 transition-all duration-300">
                {revolvingWords[revolvingWordIdx]}
                <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-amber-300 to-emerald-300 rounded-full opacity-80" />
              </span>
            </h1>

            <p className="text-sm sm:text-base text-[#D8E5DD] leading-relaxed max-w-xl animate-fade-in-up delay-200">
              BooksBuddy is a virtual community library. Neighbors share personal books without central storage—books stay safely with community members until a secure handover happens, moving from member to member.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3.5 animate-fade-in-up delay-300">
              <Button
                variant="white"
                size="md"
                onClick={scrollToDiscovery}
                className="shadow-xl font-bold px-6 py-2.5 hover:scale-105 transition-transform"
              >
                Explore Libraries
              </Button>

              <Button
                variant="secondary"
                size="md"
                onClick={scrollToHowItWorks}
                className="bg-white/10 text-[#FAF7F2] border-white/30 hover:bg-white/20 hover:border-white font-semibold px-5 backdrop-blur-xs transition-smooth"
              >
                How It Works
              </Button>

              {user ? (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => navigate('/library/new')}
                  icon={Plus}
                  className="text-[#FAF7F2] hover:bg-white/15 font-semibold transition-smooth"
                >
                  Create a New Library
                </Button>
              ) : null}
            </div>
          </div>

          {/* Right Column: Pictorial Illustrated Bookshelf Showcase */}
          <div className="lg:col-span-5 relative flex items-center justify-center pt-4 lg:pt-0 animate-fade-in-up delay-200">
            {/* Visual Composition Container */}
            <div className="relative w-full max-w-xs sm:max-w-sm h-72 sm:h-80 flex items-center justify-center">
              
              {/* Floating Chip Top-Left */}
              <div className="absolute top-1 -left-2 sm:-left-4 z-30 bg-[#0A261A]/90 backdrop-blur-md border border-emerald-400/30 rounded-2xl px-3 py-1.5 shadow-xl flex items-center gap-2 animate-float-slow">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-semibold text-[#FAF7F2] tracking-wide">
                  ✓ Verified Neighbor Handover
                </span>
              </div>

              {/* Stacked Background Book 1 (Left Tilt: The Great Gatsby) */}
              <div className="absolute w-40 sm:w-44 h-56 sm:h-64 rounded-2xl bg-gradient-to-br from-[#78350F] via-[#92400E] to-[#451A03] p-3.5 shadow-2xl transform -rotate-12 -translate-x-10 translate-y-2 border border-amber-400/30 opacity-90 transition-transform duration-500 hover:rotate-0 hover:z-40">
                <div className="h-full flex flex-col justify-between border border-amber-300/20 rounded-xl p-3 bg-amber-950/40">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-amber-200">Classic</span>
                  <div>
                    <p className="font-serif font-bold text-xs text-amber-100 line-clamp-2">The Great Gatsby</p>
                    <p className="text-[9px] text-amber-300/80">F. Scott Fitzgerald</p>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-amber-200">
                    <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                    <span>4.8 • Available</span>
                  </div>
                </div>
              </div>

              {/* Stacked Background Book 2 (Right Tilt: To Kill a Mockingbird) */}
              <div className="absolute w-40 sm:w-44 h-56 sm:h-64 rounded-2xl bg-gradient-to-br from-[#1E5C40] via-[#144731] to-[#0A261A] p-3.5 shadow-2xl transform rotate-8 translate-x-10 -translate-y-1 border border-emerald-400/30 opacity-90 transition-transform duration-500 hover:rotate-0 hover:z-40">
                <div className="h-full flex flex-col justify-between border border-emerald-400/20 rounded-xl p-3 bg-emerald-950/50">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-300">Fiction</span>
                  <div>
                    <p className="font-serif font-bold text-xs text-emerald-100 line-clamp-2">To Kill a Mockingbird</p>
                    <p className="text-[9px] text-emerald-300/80">Harper Lee</p>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-emerald-200">
                    <Star className="w-2.5 h-2.5 fill-emerald-300 text-emerald-300" />
                    <span>4.9 • Community Favorite</span>
                  </div>
                </div>
              </div>

              {/* Main Center Featured Book Card (Upright, Glowing: Atomic Habits) */}
              <div className="relative z-20 w-44 sm:w-48 h-60 sm:h-68 rounded-2xl bg-gradient-to-br from-[#FAF8F5] via-[#F4ECE1] to-[#E7D7C1] p-3.5 shadow-2xl border-2 border-white/70 transform hover:scale-105 transition-all duration-300 animate-float-reverse">
                {/* Golden top bookmark ribbon */}
                <div className="absolute -top-1.5 right-5 w-4 h-6 bg-gradient-to-b from-amber-500 to-amber-600 rounded-b-md shadow-md z-30" />
                
                <div className="h-full flex flex-col justify-between border border-[#DDCFC0] rounded-xl p-3 bg-white/80 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-forest bg-sage-tint px-2 py-0.5 rounded-full border border-sage-border/50">
                        Popular
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> 4.9
                      </span>
                    </div>
                    <h4 className="font-serif font-extrabold text-sm sm:text-base text-charcoal mt-2 leading-snug">
                      Atomic Habits
                    </h4>
                    <p className="text-[10px] text-muted font-medium">James Clear</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-[#E7D7C1]/80">
                    <div className="flex items-center gap-1.5 text-[9px] text-forest font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>With Priya P. • Tower B</span>
                    </div>
                    <div className="bg-forest/10 text-forest text-[9px] font-bold px-2 py-0.5 rounded-md text-center">
                      Ready for Next Handover
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Chip Bottom-Right */}
              <div className="absolute -bottom-2 right-0 sm:-right-2 z-30 bg-[#0A261A]/90 backdrop-blur-md border border-white/20 rounded-2xl px-3 py-1.5 shadow-xl flex items-center gap-1.5 animate-float-slow">
                <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-[11px] font-semibold text-[#FAF7F2]">
                  4-Digit PIN Security
                </span>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ─── Highlights Value Strip: Trust & Community Pillars ─── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 sm:p-5 bg-gradient-to-r from-[#FAF8F5] via-white to-[#FAF8F5] rounded-3xl border border-[#DDCFC0] shadow-card">
        <div className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/80 transition-colors">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-forest flex items-center justify-center shrink-0 border border-emerald-100 shadow-xs">
            <Compass className="w-5 h-5 text-forest" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-charcoal">Zero Central Storage</h4>
            <p className="text-[11px] text-muted">Books stay with members</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/80 transition-colors">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-100 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-charcoal">Verified Neighbors</h4>
            <p className="text-[11px] text-muted">Librarian-approved trust</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/80 transition-colors">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-forest flex items-center justify-center shrink-0 border border-emerald-100 shadow-xs">
            <KeyRound className="w-5 h-5 text-forest" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-charcoal">Secure PIN Handover</h4>
            <p className="text-[11px] text-muted">Safe in-person exchange</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/80 transition-colors">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-100 shadow-xs">
            <BookHeart className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-charcoal">100% Free Sharing</h4>
            <p className="text-[11px] text-muted">Sustainable community reading</p>
          </div>
        </div>
      </section>

      {/* ─── How It Works: 4 Clean & Pictorial Steps ─── */}
      <section ref={howItWorksSectionRef} className="space-y-6 pt-2">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-forest bg-sage-tint px-3 py-1 rounded-full border border-sage-border/50">
            Simple & Transparent
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal">
            How BooksBuddy Works
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Four simple steps to borrow and share physical books with trusted neighbors.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 space-y-3 relative hover:-translate-y-1.5 transition-all duration-300 shadow-card hover:shadow-card-hover group">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-forest text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-110 transition-transform">
                1
              </div>
              <Compass className="w-5 h-5 text-forest/40 group-hover:text-forest transition-colors" />
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal group-hover:text-forest transition-colors">
              Join a Library
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Find and join a trusted local community library in your apartment, society, or locality.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 space-y-3 relative hover:-translate-y-1.5 transition-all duration-300 shadow-card hover:shadow-card-hover group">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-110 transition-transform">
                2
              </div>
              <BookPlus className="w-5 h-5 text-amber-600/40 group-hover:text-amber-700 transition-colors" />
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal group-hover:text-forest transition-colors">
              Discover or Add Books
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Browse your neighborhood collection or share a book you have finished from your bookshelf.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 space-y-3 relative hover:-translate-y-1.5 transition-all duration-300 shadow-card hover:shadow-card-hover group">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-800 text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-110 transition-transform">
                3
              </div>
              <Clock className="w-5 h-5 text-teal-600/40 group-hover:text-teal-700 transition-colors" />
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal group-hover:text-forest transition-colors">
              Request a Book
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Send a request to the current holder or join the waiting list for high-demand titles.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 space-y-3 relative hover:-translate-y-1.5 transition-all duration-300 shadow-card hover:shadow-card-hover group">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-800 text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-110 transition-transform">
                4
              </div>
              <KeyRound className="w-5 h-5 text-rose-500/40 group-hover:text-rose-600 transition-colors" />
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal group-hover:text-forest transition-colors">
              Complete Handover
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Meet safely in your community and verify the handover using a secure one-time PIN.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Search & Discovery Header ─── */}
      <section ref={discoverySectionRef} className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-charcoal tracking-tight">
              Community Libraries
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Found <strong>{libraries.length}</strong> {libraries.length === 1 ? 'library' : 'libraries'} near you
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by library name, society, or city..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-[#FDFBF7] text-charcoal shadow-xs placeholder:text-muted/70"
            />
          </form>
        </div>

        {/* ─── Libraries Grid ─── */}
        {loading ? (
          <LoadingSpinner text="Searching libraries..." />
        ) : libraries.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No libraries found"
            description={
              searchQuery
                ? `No library matched "${searchQuery}". Try searching for another locality or create a new library.`
                : 'There are no active community libraries yet. Be the first to start one in your locality!'
            }
            actionText="Create a New Library"
            onAction={() => navigate(user ? '/library/new' : '/login')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {libraries.map((lib) => {
              const membership = getMembership(lib.id);
              const isApproved = membership?.status === 'APPROVED';
              const isPending = membership?.status === 'PENDING';

              return (
                <div
                  key={lib.id}
                  className="group bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 flex flex-col justify-between gap-6 hover:shadow-card-hover hover:border-forest/40 transition-all duration-300 relative overflow-hidden hover:-translate-y-1"
                >
                  {/* Top colorful gradient accent line */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-amber-500 to-forest opacity-70 group-hover:opacity-100 transition-opacity" />
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-sage-tint text-forest flex items-center justify-center font-bold text-base shrink-0 group-hover:scale-105 transition-transform border border-sage-border/50">
                        <Library className="w-6 h-6" />
                      </div>

                      {isApproved ? (
                        <Badge variant="success" size="sm">
                          Member ({membership.role})
                        </Badge>
                      ) : isPending ? (
                        <Badge variant="warning" size="sm">
                          <Clock className="w-3 h-3" /> Application Pending
                        </Badge>
                      ) : null}
                    </div>

                    <div>
                      <h3 className="font-serif text-lg font-bold text-charcoal group-hover:text-forest transition-colors line-clamp-1">
                        {lib.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted font-medium mt-1">
                        <MapPin className="w-3.5 h-3.5 text-muted/70 shrink-0" />
                        <span className="truncate">{lib.society_locality}, {lib.city}</span>
                      </div>
                    </div>

                    {lib.description && (
                      <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                        {lib.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted pt-1">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-forest" />
                        <strong>{lib.total_books || 0}</strong> books
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-muted/70" />
                        <strong>{lib.member_count || 1}</strong> members
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E7D7C1]">
                    {isApproved ? (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => navigate(`/library/${lib.id}`)}
                        className="w-full font-semibold"
                        icon={ArrowRight}
                      >
                        Open Library
                      </Button>
                    ) : isPending ? (
                      <Button
                        variant="outline"
                        size="md"
                        disabled
                        className="w-full text-[#8C5D23] bg-[#FAF4ED] border-[#E7C8AA] cursor-default font-semibold"
                      >
                        Request Pending
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => setSelectedLibraryToJoin(lib)}
                        className="w-full font-semibold"
                      >
                        Join Library <span className="text-xs opacity-75 font-normal">(Request to Join)</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Join Request Modal ─── */}
      {selectedLibraryToJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F291E]/50 backdrop-blur-xs">
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-5 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E7D7C1]">
              <div className="w-11 h-11 rounded-2xl bg-sage-tint text-forest flex items-center justify-center shrink-0">
                <Library className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-charcoal">
                  Join {selectedLibraryToJoin.name}
                </h3>
                <p className="text-xs text-muted">
                  {selectedLibraryToJoin.society_locality}, {selectedLibraryToJoin.city}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              BooksBuddy communities are neighborhood-verified. When you submit your application,
              the primary librarian will review and approve your membership.
            </p>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Invitation Code <span className="text-muted font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. LIB-A1B2C3"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white font-mono uppercase"
                />
                <p className="text-[11px] text-muted mt-1">
                  If a neighbor shared an invite code, enter it above to expedite your membership.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setSelectedLibraryToJoin(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  loading={joining}
                  className="font-bold px-5"
                >
                  Submit Application
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
