import React, { useState, useEffect } from 'react';
import { librariesApi } from '../api/libraries.api';
import { booksApi } from '../api/books.api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { BookCard } from '../components/catalogue/BookCard';
import { DonateBookModal } from '../components/catalogue/DonateBookModal';
import { BookDemandsTab } from '../components/community/BookDemandsTab';
import { LedgerTab } from '../components/community/LedgerTab';
import { NoticesTab } from '../components/community/NoticesTab';
import { MembersTab } from '../components/librarian/MembersTab';
import { RulesTab } from '../components/librarian/RulesTab';
import { InviteCodeCard } from '../components/librarian/InviteCodeCard';
import {
  Library,
  BookOpen,
  BookPlus,
  Search,
  Users,
  MapPin,
  Shield,
  Coins,
  Bell,
  SlidersHorizontal,
  ArrowLeft,
  BookHeart,
  Clock,
  Calendar,
  Layers,
  RotateCw,
} from 'lucide-react';

export function LibraryHomeScreen({ libraryId }) {
  const { user, isMemberOf, isLibrarianOf, getMembership, refreshUser } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const isMember = isMemberOf(libraryId);
  const isLibrarian = isLibrarianOf(libraryId);
  const membership = getMembership(libraryId);

  const [library, setLibrary] = useState(null);
  const [loadingLib, setLoadingLib] = useState(true);

  // Active Tab
  const getInitialTab = () => {
    try {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['catalogue', 'demands', 'ledger', 'notices', 'admin'].includes(hash)) {
        return hash;
      }
    } catch {}
    return 'catalogue';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);

  const setActiveTab = (tabId) => {
    try {
      if (window.location.hash !== `#${tabId}`) {
        window.history.replaceState(null, '', `#${tabId}`);
      }
    } catch {}
    setActiveTabState(tabId);
  };

  // Catalogue State
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showDonateModal, setShowDonateModal] = useState(false);

  const loadLibraryDetails = async () => {
    try {
      const res = await librariesApi.getById(libraryId);
      setLibrary(res.library);
    } catch (err) {
      showToast(err.message || 'Failed to load library details.', 'error');
    } finally {
      setLoadingLib(false);
    }
  };

  const loadBooks = async () => {
    setLoadingBooks(true);
    try {
      const res = await booksApi.search({
        library_id: libraryId,
        q: searchQuery,
        status: statusFilter,
        page,
        limit: 12,
      });
      setBooks(res.books || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err) {
      showToast(err.message || 'Failed to load catalogue.', 'error');
    } finally {
      setLoadingBooks(false);
    }
  };

  useEffect(() => {
    loadLibraryDetails();
    if (user) {
      refreshUser();
    }
  }, [libraryId]);

  useEffect(() => {
    if (activeTab === 'catalogue') {
      loadBooks();
    }
  }, [libraryId, activeTab, searchQuery, statusFilter, page]);

  if (loadingLib) {
    return <LoadingSpinner text="Loading library..." />;
  }

  if (!library) {
    return (
      <EmptyState
        icon={Library}
        title="Library not found"
        description="This library might have been moved or does not exist."
        actionText="Back to Discovery"
        onAction={() => navigate('/')}
      />
    );
  }

  const tabs = [
    { id: 'catalogue', label: 'Books Catalogue', icon: BookOpen },
    ...(isMember
      ? [
          { id: 'demands', label: 'Wishlist & Demands', icon: BookHeart },
          { id: 'ledger', label: 'Financial Ledger', icon: Coins },
          { id: 'notices', label: 'Notice Board', icon: Bell },
        ]
      : []),
    ...(isLibrarian
      ? [{ id: 'admin', label: 'Librarian Dashboard', icon: Shield }]
      : []),
  ];

  const hasSearchOrFilter = Boolean(searchQuery.trim() || statusFilter);

  return (
    <div className="space-y-6 py-2">
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-forest transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Explore All Libraries
      </button>

      {/* ─── Refined Library Header: Strong Visual Hierarchy ─── */}
      <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 sm:p-8 shadow-card flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-start gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-sage-tint text-forest flex items-center justify-center font-bold text-lg shrink-0 border border-sage-border/60">
              <Library className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal tracking-tight">
                  {library.name}
                </h1>
                {membership?.status === 'APPROVED' && (
                  <Badge variant="success" size="sm">
                    Member ({membership.role})
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted font-medium mt-1">
                <MapPin className="w-3.5 h-3.5 text-muted/70 shrink-0" />
                <span>{library.society_locality}, {library.city}</span>
              </div>
            </div>
          </div>

          {library.description && (
            <p className="text-xs text-muted leading-relaxed max-w-xl">
              {library.description}
            </p>
          )}

          {/* ─── Compact Information Cards for Library Rules ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            <div className="bg-[#FAF6EE] rounded-2xl border border-[#E7D7C1] p-3 text-center">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">
                Borrowing period
              </span>
              <strong className="text-sm font-serif font-bold text-charcoal">
                {library.max_borrow_days} days
              </strong>
            </div>

            <div className="bg-[#FAF6EE] rounded-2xl border border-[#E7D7C1] p-3 text-center">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">
                Handover window
              </span>
              <strong className="text-sm font-serif font-bold text-charcoal">
                {library.handover_window_hours} hours
              </strong>
            </div>

            <div className="bg-[#FAF6EE] rounded-2xl border border-[#E7D7C1] p-3 text-center">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">
                Book limit
              </span>
              <strong className="text-sm font-serif font-bold text-charcoal">
                {library.max_books_per_member} books
              </strong>
            </div>

            <div className="bg-[#FAF6EE] rounded-2xl border border-[#E7D7C1] p-3 text-center">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">
                Renewals
              </span>
              <strong className="text-sm font-serif font-bold text-charcoal">
                {library.max_renewals}
              </strong>
            </div>
          </div>
        </div>

        {/* Header Action Button */}
        <div className="shrink-0 flex flex-col sm:flex-row gap-3 pt-1">
          {isMember ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowDonateModal(true)}
              icon={BookPlus}
              className="font-bold shadow-sm"
            >
              Donate a Book
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/')}
              className="font-bold"
            >
              Request Membership
            </Button>
          )}
        </div>
      </div>

      {/* ─── Tabs Navigation ─── */}
      <div className="border-b border-[#DDCFC0]">
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-px" aria-label="Library Sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold whitespace-nowrap transition-all duration-150 rounded-t-xl ${
                  isActive
                    ? 'border-forest text-forest bg-sage-tint/40 shadow-xs'
                    : 'border-transparent text-muted hover:text-charcoal hover:bg-[#F2EDE4]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── Tab 1: Catalogue ─── */}
      {activeTab === 'catalogue' && (
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#FDFBF7] p-4 rounded-2xl border border-[#DDCFC0] shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search catalogue by title, author, or genre..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal font-semibold"
              >
                <option value="">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="BORROWED">Borrowed</option>
                <option value="RESERVED">Reserved</option>
              </select>
            </div>
          </div>

          {/* Books Catalogue Grid & Clear Separated Empty States */}
          {loadingBooks ? (
            <LoadingSpinner text="Loading catalogue books..." />
          ) : books.length === 0 ? (
            hasSearchOrFilter ? (
              /* State A: Zero search results */
              <EmptyState
                icon={BookOpen}
                title="No books match your search"
                description={`No books found matching "${searchQuery}". Try another title, author, or genre.`}
                actionText="Clear Search"
                onAction={() => {
                  setSearchQuery('');
                  setStatusFilter('');
                }}
              />
            ) : (
              /* State B: Library genuinely has zero books */
              <EmptyState
                icon={BookOpen}
                title="No books in this library yet."
                description="Be the first to add a book to the community."
                actionText={isMember ? 'Donate a Book' : undefined}
                onAction={isMember ? () => setShowDonateModal(true) : undefined}
              />
            )
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onClick={() => navigate(`/library/${libraryId}/book/${book.id}`)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-muted font-semibold">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 2: Wishlist & Demands ─── */}
      {activeTab === 'demands' && isMember && (
        <BookDemandsTab libraryId={libraryId} />
      )}

      {/* ─── Tab 3: Financial Ledger ─── */}
      {activeTab === 'ledger' && isMember && (
        <LedgerTab libraryId={libraryId} isLibrarian={isLibrarian} />
      )}

      {/* ─── Tab 4: Notice Board ─── */}
      {activeTab === 'notices' && isMember && (
        <NoticesTab libraryId={libraryId} isLibrarian={isLibrarian} />
      )}

      {/* ─── Tab 5: Librarian Dashboard ─── */}
      {activeTab === 'admin' && isLibrarian && (
        <div className="space-y-8">
          <InviteCodeCard libraryId={libraryId} inviteCode={library.invite_code} />
          <MembersTab libraryId={libraryId} />
          <RulesTab library={library} onRulesUpdated={loadLibraryDetails} />
        </div>
      )}

      {/* Donate Book Modal */}
      {showDonateModal && (
        <DonateBookModal
          isOpen={showDonateModal}
          onClose={() => setShowDonateModal(false)}
          libraryId={libraryId}
          onBookDonated={() => {
            setShowDonateModal(false);
            loadBooks();
            loadLibraryDetails();
          }}
        />
      )}
    </div>
  );
}
