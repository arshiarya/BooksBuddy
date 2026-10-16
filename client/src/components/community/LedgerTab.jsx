import React, { useState, useEffect } from 'react';
import { communityApi } from '../../api/community.api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { EmptyState, LoadingSpinner } from '../common/EmptyState';
import { Coins, Plus, TrendingUp, TrendingDown, Wallet, ShieldAlert, Check } from 'lucide-react';

export function LedgerTab({ libraryId }) {
  const { isLibrarianOf } = useAuth();
  const { showToast } = useToast();
  const isLibrarian = isLibrarianOf(libraryId);

  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);

  const [formData, setFormData] = useState({
    entry_type: 'DONATION',
    category: 'BOOK_PURCHASE',
    amount: '',
    description: '',
    contributor_name: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadLedger = async () => {
    try {
      const res = await communityApi.getLedger(libraryId);
      setLedgerData(res);
    } catch (err) {
      showToast(err.message || 'Failed to load financial ledger.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [libraryId]);

  const handleCreateEntry = async (e) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      showToast('Please provide a positive amount.', 'error');
      return;
    }
    if (!formData.description.trim()) {
      showToast('A description is required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await communityApi.createLedgerEntry(libraryId, {
        type: formData.entry_type || formData.type,
        amount: amt,
        description: formData.description,
        user_id: formData.user_id || undefined,
      });
      showToast('Ledger entry recorded successfully!', 'success');
      setFormData({
        entry_type: 'DONATION',
        category: 'BOOK_PURCHASE',
        amount: '',
        description: '',
        contributor_name: '',
      });
      setShowEntryModal(false);
      loadLedger();
    } catch (err) {
      showToast(err.message || 'Failed to record entry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalInflow = ledgerData?.summary?.totalDonations ?? ledgerData?.summary?.total_donations ?? ledgerData?.summary?.total_inflow ?? 0;
  const totalOutflow = ledgerData?.summary?.totalExpenses ?? ledgerData?.summary?.total_expenses ?? ledgerData?.summary?.total_outflow ?? 0;
  const netBalance = ledgerData?.summary?.netBalance ?? ledgerData?.summary?.net_balance ?? 0;

  return (
    <div className="space-y-6">
      {/* Policy Disclaimer Banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-900">Community Financial Transparency Notice</p>
          <p className="leading-relaxed">
            All library financial records are fully public to members. Voluntary contributions are
            utilized exclusively for book acquisition, repair, and community reading events.
            <strong>
              {' '}Voluntary contributions do NOT grant extra borrowing limits, priority waitlist status,
              or administrative privileges.
            </strong>
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 tracking-wider">
              Total Inflow
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              ₹{Number(totalInflow).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 tracking-wider">
              Total Outflow
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              ₹{Number(totalOutflow).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 tracking-wider">
              Net Balance
            </p>
            <p className="text-xl font-bold text-brand-700 mt-0.5">
              ₹{Number(netBalance).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Action Bar for Librarians */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Ledger Transactions</h4>
          <p className="text-xs text-slate-500">Itemized chronological records of all funds.</p>
        </div>

        {isLibrarian && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowEntryModal(true)}
            icon={Plus}
          >
            Record Entry
          </Button>
        )}
      </div>

      {/* Ledger Table */}
      {loading ? (
        <LoadingSpinner text="Loading financial records..." />
      ) : !ledgerData?.entries || ledgerData.entries.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No transactions yet"
          description="The library ledger has no recorded contributions or expenses yet."
          actionText={isLibrarian ? 'Record First Entry' : undefined}
          onAction={isLibrarian ? () => setShowEntryModal(true) : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Contributor / Vendor</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerData.entries.map((entry) => {
                  const entryType = entry.type || entry.entry_type || 'DONATION';
                  const isDonation = entryType === 'DONATION';
                  const dateStr = entry.recorded_at || entry.created_at || Date.now();
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {new Date(dateStr).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={isDonation ? 'success' : 'danger'} size="sm">
                          {entryType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                        {entry.category || 'GENERAL'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                        {entry.description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {entry.contributor_name || 'Anonymous Community Member'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-slate-900">
                        <span className={isDonation ? 'text-emerald-600' : 'text-rose-600'}>
                          {isDonation ? '+' : '-'}₹{parseFloat(entry.amount).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Entry Modal for Librarians */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-0 zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">Record Ledger Transaction</h3>
            <p className="text-xs text-slate-500">
              Only librarians can record financial transactions. Entries are publicly auditable.
            </p>

            <form onSubmit={handleCreateEntry} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Entry Type *
                  </label>
                  <select
                    value={formData.entry_type}
                    onChange={(e) => setFormData({ ...formData, entry_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="DONATION">DONATION (Inflow)</option>
                    <option value="EXPENSE">EXPENSE (Outflow)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="BOOK_PURCHASE">BOOK_PURCHASE</option>
                  <option value="MAINTENANCE">MAINTENANCE & REPAIR</option>
                  <option value="COMMUNITY_EVENT">COMMUNITY_EVENT</option>
                  <option value="STATIONERY">STATIONERY / BOOKMARKS</option>
                  <option value="GENERAL">GENERAL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Purchased 3 copies of Harry Potter for kids"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contributor or Payee (Optional)
                </label>
                <input
                  type="text"
                  value={formData.contributor_name}
                  onChange={(e) => setFormData({ ...formData, contributor_name: e.target.value })}
                  placeholder="e.g. Tower B Residents or Amazon India"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEntryModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  icon={Coins}
                >
                  Record Transaction
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
