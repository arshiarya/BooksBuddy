import React, { useState, useEffect } from 'react';
import { librariesApi } from '../api/libraries.api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState, LoadingSpinner } from '../components/common/EmptyState';
import { Library, Search, Plus, MapPin, Users, BookOpen, Key, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

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
    <div className="space-y-8 py-4">
      {/* Hero Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-brand-800 via-brand-700 to-emerald-800 p-8 sm:p-12 text-white overflow-hidden shadow-sm">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-sm border border-white/20 text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            Hyperlocal Virtual Communities
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Discover Neighborhood Libraries Near You
          </h2>

          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-xl">
            Borrow, donate, and exchange books directly with trusted neighbors. Books stay on personal
            bookshelves until borrowed, secured with one-time verification PINs.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            {user ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/library/new')}
                className="bg-white text-brand-900 hover:bg-slate-100 shadow-sm"
                icon={Plus}
              >
                Create a New Library
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/register')}
                className="bg-white text-brand-900 hover:bg-slate-100 shadow-sm"
              >
                Get Started
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Search & Discovery Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by library name, society, or city..."
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white shadow-xs"
          />
        </form>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Found <strong>{libraries.length}</strong> libraries</span>
        </div>
      </div>

      {/* Libraries Grid */}
      {loading ? (
        <LoadingSpinner text="Searching libraries..." />
      ) : libraries.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No libraries found"
          description={
            searchQuery
              ? `No library matched "${searchQuery}". Try a different locality or start one!`
              : 'There are no active community libraries yet. Be the first to start one!'
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
                className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between gap-6 hover:shadow-md hover:border-brand-300 transition-all duration-200 group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-base shrink-0 group-hover:scale-105 transition-transform">
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
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1">
                      {lib.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{lib.society_locality}, {lib.city}</span>
                    </div>
                  </div>

                  {lib.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {lib.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-brand-600" />
                      <strong>{lib.total_books || 0}</strong> books
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <strong>{lib.member_count || 1}</strong> members
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  {isApproved ? (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => navigate(`/library/${lib.id}`)}
                      className="w-full"
                      icon={ArrowRight}
                    >
                      Enter Library
                    </Button>
                  ) : isPending ? (
                    <Button
                      variant="outline"
                      size="md"
                      disabled
                      className="w-full text-amber-700 bg-amber-50 border-amber-200 cursor-default"
                    >
                      Awaiting Approval
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => setSelectedLibraryToJoin(lib)}
                      className="w-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300"
                    >
                      Request to Join
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Join Request Modal */}
      {selectedLibraryToJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
                <Library className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Join {selectedLibraryToJoin.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedLibraryToJoin.society_locality}, {selectedLibraryToJoin.city}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Your membership application will be sent to the library librarians for verification.
              If your community shares an invite code, enter it below to expedite approval.
            </p>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invitation Code (Optional)
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value)}
                    placeholder="e.g. BB-9X72"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLibraryToJoin(null)}
                  disabled={joining}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={joining}
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
