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
      {/* ─── Hero Section: Value Proposition ─── */}
      <section className="relative rounded-3xl bg-[#1B4332] text-[#F6F1E7] p-8 sm:p-12 lg:p-16 overflow-hidden shadow-card border border-[#143527]">
        {/* Subtle decorative background pattern */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#F6F1E7 1.5px, transparent 1.5px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Ambient warm gradient highlight */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#6B8F71]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-xs border border-white/20 text-[#FAF7F2]">
            <ShieldCheck className="w-4 h-4 text-[#8EAE93]" />
            Hyperlocal Community Library
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-[#FAF7F2] leading-[1.15]">
            Borrow Books From Your Community
          </h1>

          <p className="text-sm sm:text-base text-[#D8E5DD] leading-relaxed max-w-xl">
            BooksBuddy is a virtual community library. Neighbors share personal books without central storage—books stay safely with community members until a secure handover happens, moving from member to member.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="white"
              size="md"
              onClick={scrollToDiscovery}
              className="shadow-md font-bold px-6 py-2.5"
            >
              Explore Libraries
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={scrollToHowItWorks}
              className="bg-transparent text-[#FAF7F2] border-white/40 hover:bg-white/10 hover:border-white font-semibold px-5"
            >
              How It Works
            </Button>

            {user ? (
              <Button
                variant="ghost"
                size="md"
                onClick={() => navigate('/library/new')}
                icon={Plus}
                className="text-[#FAF7F2] hover:bg-white/10 font-semibold"
              >
                Create a New Library
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {/* ─── How It Works: 4 Clean Steps ─── */}
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
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 space-y-3 relative hover:-translate-y-1 transition-transform duration-200 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-sage-tint text-forest flex items-center justify-center font-bold text-sm border border-sage-border/60">
              1
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal">
              Join a Library
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Find and join a trusted local community library in your apartment, society, or locality.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 space-y-3 relative hover:-translate-y-1 transition-transform duration-200 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-sage-tint text-forest flex items-center justify-center font-bold text-sm border border-sage-border/60">
              2
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal">
              Discover or Add Books
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Browse your neighborhood collection or share a book you have finished from your bookshelf.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 space-y-3 relative hover:-translate-y-1 transition-transform duration-200 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-sage-tint text-forest flex items-center justify-center font-bold text-sm border border-sage-border/60">
              3
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal">
              Request a Book
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Send a request to the current holder or join the waiting list for high-demand titles.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 space-y-3 relative hover:-translate-y-1 transition-transform duration-200 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-sage-tint text-forest flex items-center justify-center font-bold text-sm border border-sage-border/60">
              4
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal">
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
                  className="group bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 flex flex-col justify-between gap-6 hover:shadow-card-hover hover:border-forest/40 transition-all duration-200"
                >
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
