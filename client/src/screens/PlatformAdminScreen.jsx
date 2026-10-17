import React, { useState, useEffect } from 'react';
import { adminApi } from '../api/admin.api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  ShieldAlert,
  ShieldCheck,
  Library,
  Users,
  BookOpen,
  ArrowRight,
  Search,
  AlertTriangle,
  CheckCircle,
  Ban,
  Trash2,
  RefreshCw,
  ExternalLink,
  MapPin,
} from 'lucide-react';

export function PlatformAdminScreen() {
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [stats, setStats] = useState(null);
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Deletion Confirmation Modal State
  const [libraryToDelete, setLibraryToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isPlatformAdmin = Boolean(user && (user.isPlatformAdmin || user.role === 'PLATFORM_ADMIN'));

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, libsRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getAllLibraries(),
      ]);
      setStats(statsRes.stats);
      setLibraries(libsRes.libraries || []);
    } catch (err) {
      showToast(err.message || 'Failed to load platform administration data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPlatformAdmin) {
      loadData();
    }
  }, [isPlatformAdmin]);

  // Guard against non-admin access
  if (!user || !isPlatformAdmin) {
    return (
      <div className="py-16 max-w-lg mx-auto">
        <EmptyState
          icon={ShieldAlert}
          title="Access Restricted"
          description="You do not have platform administrator privileges. This control panel is reserved exclusively for system operators."
          actionText="Return to Community Libraries"
          onAction={() => navigate('/')}
        />
      </div>
    );
  }

  // Handle Suspend / Reactivate Toggle
  const handleToggleStatus = async (library) => {
    const newStatus = library.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setActionLoadingId(library.id);
    try {
      await adminApi.updateStatus(library.id, newStatus);
      showToast(`Library "${library.name}" marked as ${newStatus}.`, 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to update library status.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Permanent Deletion of Suspicious / Discarded Library
  const handleConfirmDelete = async () => {
    if (!libraryToDelete) return;
    setDeleting(true);
    try {
      const res = await adminApi.deleteLibrary(libraryToDelete.id);
      showToast(res.message || 'Library removed successfully.', 'success');
      setLibraryToDelete(null);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to remove library.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered Libraries
  const filteredLibraries = libraries.filter((lib) => {
    const matchesSearch =
      lib.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      lib.society_locality.toLowerCase().includes(searchFilter.toLowerCase()) ||
      lib.city.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (lib.creator_name && lib.creator_name.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (lib.creator_email && lib.creator_email.toLowerCase().includes(searchFilter.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && lib.status === 'ACTIVE') ||
      (statusFilter === 'SUSPENDED' && lib.status === 'SUSPENDED');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 py-2 max-w-7xl mx-auto">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DDCFC0]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-forest text-ivory mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-sage-light" />
            Platform Operator Controls
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-charcoal">
            Platform Administration
          </h1>
          <p className="text-xs text-muted mt-1">
            Global oversight across all BooksBuddy community libraries, active memberships, and catalog integrity.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadData}
          loading={loading}
          icon={RefreshCw}
          className="font-semibold"
        >
          Refresh Data
        </Button>
      </div>

      {/* ─── Overview Stats Strip ─── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#FDFBF7] p-5 rounded-3xl border border-[#DDCFC0] shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Total Libraries</span>
              <Library className="w-4 h-4 text-forest" />
            </div>
            <p className="text-2xl font-serif font-extrabold text-charcoal">
              {stats.totalLibraries}
            </p>
            <p className="text-[11px] text-muted">
              {stats.activeLibraries} active &bull; {stats.suspendedLibraries} suspended
            </p>
          </div>

          <div className="bg-[#FDFBF7] p-5 rounded-3xl border border-[#DDCFC0] shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Total Members</span>
              <Users className="w-4 h-4 text-forest" />
            </div>
            <p className="text-2xl font-serif font-extrabold text-charcoal">
              {stats.totalUsers}
            </p>
            <p className="text-[11px] text-muted">Registered platform accounts</p>
          </div>

          <div className="bg-[#FDFBF7] p-5 rounded-3xl border border-[#DDCFC0] shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Catalog Books</span>
              <BookOpen className="w-4 h-4 text-forest" />
            </div>
            <p className="text-2xl font-serif font-extrabold text-charcoal">
              {stats.totalBooks}
            </p>
            <p className="text-[11px] text-muted">Shared across all collections</p>
          </div>

          <div className="bg-[#FDFBF7] p-5 rounded-3xl border border-[#DDCFC0] shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Active Handovers</span>
              <CheckCircle className="w-4 h-4 text-forest" />
            </div>
            <p className="text-2xl font-serif font-extrabold text-charcoal">
              {stats.activeHandovers}
            </p>
            <p className="text-[11px] text-muted">In-flight loans & handovers</p>
          </div>
        </div>
      )}

      {/* ─── Search & Status Filters ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search by library, locality, or creator..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-[#FDFBF7] text-charcoal shadow-xs"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-2">
          {['ALL', 'ACTIVE', 'SUSPENDED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-forest text-ivory shadow-xs'
                  : 'bg-[#FAF6EE] text-muted hover:text-charcoal border border-[#E7D7C1]'
              }`}
            >
              {st === 'ALL' ? 'All Libraries' : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ─── All Libraries Management Table ─── */}
      {loading ? (
        <LoadingSpinner text="Loading all libraries for platform administration..." />
      ) : filteredLibraries.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No libraries match your criteria"
          description={
            searchFilter
              ? `No library matched "${searchFilter}". Try adjusting your search query.`
              : 'There are currently no libraries registered in the database.'
          }
        />
      ) : (
        <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF4ED] border-b border-[#E7D7C1] text-charcoal font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Library & Locality</th>
                  <th className="py-3.5 px-4">Creator / Contact</th>
                  <th className="py-3.5 px-4 text-center">Books</th>
                  <th className="py-3.5 px-4 text-center">Members</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7D7C1]">
                {filteredLibraries.map((lib) => {
                  const isActive = lib.status === 'ACTIVE';
                  const isActionLoading = actionLoadingId === lib.id;

                  return (
                    <tr key={lib.id} className="hover:bg-[#FAF8F5] transition-colors">
                      {/* Library & Locality */}
                      <td className="py-4 px-4 space-y-0.5">
                        <div className="font-serif font-bold text-sm text-charcoal">
                          {lib.name}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted">
                          <MapPin className="w-3 h-3 text-muted/80 shrink-0" />
                          <span>{lib.society_locality}, {lib.city}</span>
                        </div>
                        <span className="text-[10px] text-muted font-mono">
                          ID: #{lib.id} &bull; Code: {lib.invite_code || 'N/A'}
                        </span>
                      </td>

                      {/* Creator */}
                      <td className="py-4 px-4 space-y-0.5">
                        <div className="font-semibold text-charcoal">
                          {lib.creator_name || `User #${lib.created_by}`}
                        </div>
                        <div className="text-[11px] text-muted font-mono">
                          {lib.creator_email || 'No email registered'}
                        </div>
                      </td>

                      {/* Books Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-bold text-charcoal px-2 py-0.5 rounded-md bg-sage-tint border border-sage-border/40">
                          {lib.total_books}
                        </span>
                      </td>

                      {/* Members Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-bold text-charcoal px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                          {lib.total_members}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        {isActive ? (
                          <Badge variant="success" size="sm">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            {lib.status}
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                        {/* Open Library in App */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/library/${lib.id}`)}
                          icon={ExternalLink}
                          title="Open library page"
                          className="text-forest hover:bg-forest/10"
                        >
                          View
                        </Button>

                        {/* Suspend / Reactivate */}
                        <Button
                          variant={isActive ? 'outline' : 'primary'}
                          size="sm"
                          onClick={() => handleToggleStatus(lib)}
                          loading={isActionLoading}
                          icon={isActive ? Ban : CheckCircle}
                          className={isActive ? 'text-amber-800 border-amber-300 hover:bg-amber-50 font-semibold' : 'font-semibold'}
                        >
                          {isActive ? 'Suspend' : 'Reactivate'}
                        </Button>

                        {/* Discard / Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLibraryToDelete(lib)}
                          icon={Trash2}
                          title="Discard / Delete library"
                          className="text-rose-700 hover:bg-rose-50"
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Deletion Confirmation Modal ─── */}
      {libraryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FDFBF7] rounded-3xl border border-rose-300 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-charcoal">
                  Confirm Library Removal
                </h3>
                <p className="text-xs text-muted">This action is permanent and irreversible.</p>
              </div>
            </div>

            <p className="text-xs text-charcoal leading-relaxed bg-rose-50/70 p-3.5 rounded-xl border border-rose-200">
              Are you sure you want to completely remove <strong>"{libraryToDelete.name}"</strong> (ID: #{libraryToDelete.id}) from BooksBuddy?
              All associated catalog records, book entries, and membership links will be purged.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLibraryToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                loading={deleting}
                icon={Trash2}
                className="bg-rose-700 hover:bg-rose-800 text-white font-bold"
              >
                Permanently Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
