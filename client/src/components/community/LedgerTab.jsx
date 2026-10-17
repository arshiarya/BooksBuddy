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
        category: formData.category,
        contributor_name: formData.contributor_name || undefined,
      });

      showToast('Financial ledger entry recorded successfully.', 'success');
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
      <div className="flex items-start gap-3 p-4 sm:p-5 rounded-3xl bg-[#FAF4ED] border border-[#E7C8AA] text-[#8C5D23] text-xs shadow-xs">
        <ShieldAlert className="w-5 h-5 text-gold shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-serif font-bold text-sm text-charcoal">Community Financial Transparency Notice</p>
          <p className="leading-relaxed text-muted">
            All library financial records are fully public to members. Voluntary contributions are
            utilized exclusively for book acquisition, repair, and community reading events.
            <strong className="text-charcoal font-semibold">
              {' '}Voluntary contributions do NOT grant extra borrowing limits, priority waitlist status,
              or administrative privileges.
            </strong>
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#FDFBF7] p-5 rounded-3xl border border-[#DDCFC0] shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sage-tint text-forest flex items-center justify-center shrink-0 border border-sage-border/60">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted tracking-wider">
              Total Inflow
            </p>
            <p className="font-serif text-xl font-bold text-charcoal mt-0.5">
              ₹{Number(totalInflow).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-[#FDFBF7] p-5 rounded-3xl border border-[#DDCFC0] shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FAF0ED] text-[#C97B63] flex items-center justify-center shrink-0 border border-[#E8BDB1]">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted tracking-wider">
              Total Outflow
            </p>
            <p className="font-serif text-xl font-bold text-charcoal mt-0.5">
              ₹{Number(totalOutflow).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-[#FDFBF7] p-5 rounded-3xl border border-[#DDCFC0] shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sage-tint text-forest flex items-center justify-center shrink-0 border border-sage-border/60">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted tracking-wider">
              Net Balance
            </p>
            <p className="font-serif text-xl font-bold text-forest mt-0.5">
              ₹{Number(netBalance).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Action Bar for Librarians */}
      <div className="flex items-center justify-between gap-4 bg-[#FDFBF7] p-4 sm:p-5 rounded-3xl border border-[#DDCFC0] shadow-xs">
        <div>
          <h4 className="font-serif text-base font-bold text-charcoal">Ledger Transactions</h4>
          <p className="text-xs text-muted">Itemized chronological records of all community funds.</p>
        </div>

        {isLibrarian && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowEntryModal(true)}
            icon={Plus}
            className="font-bold"
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
        <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted">
              <thead className="bg-[#FAF6EE] text-[10px] font-bold uppercase tracking-wider text-charcoal border-b border-[#E7D7C1]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Contributor / Payee</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7D7C1]">
                {ledgerData.entries.map((entry) => {
                  const isInflow = entry.type === 'DONATION' || entry.type === 'INFLOW';
                  return (
                    <tr key={entry.id} className="hover:bg-[#FAF6EE]/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted font-medium">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={isInflow ? 'success' : 'danger'} size="sm">
                          {entry.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-charcoal">
                        {entry.category}
                      </td>
                      <td className="px-4 py-3 text-charcoal font-medium">
                        {entry.description}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {entry.contributor_name || 'Community Member'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-serif font-bold whitespace-nowrap ${
                          isInflow ? 'text-forest' : 'text-terracotta'
                        }`}
                      >
                        {isInflow ? '+' : '-'}₹{Number(entry.amount).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F291E]/50 backdrop-blur-xs">
          <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-4 animate-in fade-in-0 zoom-in-95">
            <h3 className="font-serif text-lg font-bold text-charcoal">Record Financial Transaction</h3>
            <p className="text-xs text-muted">
              Add a transparent record of book purchases, voluntary donations, or maintenance costs.
            </p>

            <form onSubmit={handleCreateEntry} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">
                    Entry Type *
                  </label>
                  <select
                    value={formData.entry_type}
                    onChange={(e) => setFormData({ ...formData, entry_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal font-semibold"
                  >
                    <option value="DONATION">DONATION (Inflow)</option>
                    <option value="EXPENSE">EXPENSE (Outflow)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal font-semibold"
                >
                  <option value="BOOK_PURCHASE">BOOK_PURCHASE</option>
                  <option value="MAINTENANCE">MAINTENANCE & REPAIR</option>
                  <option value="COMMUNITY_EVENT">COMMUNITY_EVENT</option>
                  <option value="STATIONERY">STATIONERY / BOOKMARKS</option>
                  <option value="GENERAL">GENERAL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Purchased 3 copies of Harry Potter for kids"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Contributor or Payee (Optional)
                </label>
                <input
                  type="text"
                  value={formData.contributor_name}
                  onChange={(e) => setFormData({ ...formData, contributor_name: e.target.value })}
                  placeholder="e.g. Tower B Residents or Amazon India"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7D7C1]">
                <Button
                  variant="ghost"
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
                  className="font-bold"
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
