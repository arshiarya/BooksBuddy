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
  Sliders,
  SlidersHorizontal,
  ArrowLeft,
  BookHeart,
  Key,
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

  // Active Tab: driven by URL hash (supports page reloads cleanly) or default to catalogue
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

  return (
    <div className="space-y-6 py-4">
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> All Libraries
      </button>

      {/* Library Banner Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-base shrink-0">
              <Library className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {library.name}
                </h1>
                {membership?.status === 'APPROVED' && (
                  <Badge variant="success" size="sm">
                    Member ({membership.role})
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{library.society_locality}, {library.city}</span>
              </div>
            </div>
          </div>

          {library.description && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {library.description}
            </p>
          )}

          {/* Quick Rules Metadata Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
            <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
              Loan: <strong>{library.max_borrow_days} days</strong>
            </span>
            <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
              Handover Window: <strong>{library.handover_window_hours}h</strong>
            </span>
            <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
              Limit: <strong>{library.max_books_per_member} books</strong>
            </span>
            <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
              Renewals: <strong>{library.max_renewals}</strong>
            </span>
          </div>
        </div>

        {/* Header Action Button */}
        <div className="shrink-0 flex flex-col sm:flex-row gap-3">
          {isMember ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowDonateModal(true)}
              icon={BookPlus}
            >
              Donate a Book
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/')}
            >
              Request Membership
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex items-center gap-2 overflow-x-auto pb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-brand-600 text-brand-700 bg-brand-50/50 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab 1: Catalogue */}
      {activeTab === 'catalogue' && (
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search catalogue by title, author, or genre..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-slate-700 font-medium"
              >
                <option value="">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="BORROWED">Borrowed</option>
                <option value="RESERVED">Reserved</option>
              </select>
            </div>
          </div>

          {/* Books Catalogue Grid */}
          {loadingBooks ? (
            <LoadingSpinner text="Loading catalogue books..." />
          ) : books.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No books match your search"
              description={
                searchQuery
                  ? `No books found matching "${searchQuery}".`
                  : 'This library currently has no books in its collection. Be the first to donate!'
              }
              actionText={isMember ? 'Donate a Book Now' : undefined}
              onAction={isMember ? () => setShowDonateModal(true) : undefined}
            />
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
              <span className="text-xs text-slate-600 font-medium">
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

      {/* Tab 2: Book Demands Wishlist */}
      {activeTab === 'demands' && isMember && (
        <BookDemandsTab libraryId={libraryId} />
      )}

      {/* Tab 3: Financial Ledger */}
      {activeTab === 'ledger' && isMember && (
        <LedgerTab libraryId={libraryId} />
      )}

      {/* Tab 4: Notice Board */}
      {activeTab === 'notices' && isMember && (
        <NoticesTab libraryId={libraryId} />
      )}

      {/* Tab 5: Librarian Admin Hub */}
      {activeTab === 'admin' && isLibrarian && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InviteCodeCard
              libraryId={libraryId}
              initialInviteCode={library.invite_code}
              onCodeRegenerated={(newCode) =>
                setLibrary((prev) => ({ ...prev, invite_code: newCode }))
              }
            />
            <RulesTab
              library={library}
              onRulesUpdated={loadLibraryDetails}
            />
          </div>

          <MembersTab libraryId={libraryId} />
        </div>
      )}

      {/* Donate Modal */}
      <DonateBookModal
        isOpen={showDonateModal}
        onClose={() => setShowDonateModal(false)}
        libraryId={libraryId}
        onSuccess={() => {
          setActiveTab('catalogue');
          loadBooks();
          loadLibraryDetails();
        }}
      />
    </div>
  );
}
