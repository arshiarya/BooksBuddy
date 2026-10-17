import React, { useState, useEffect } from 'react';
import { librariesApi } from '../../api/libraries.api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { EmptyState, LoadingSpinner } from '../common/EmptyState';
import { Users, Check, X, Shield, UserCheck, UserX } from 'lucide-react';

export function MembersTab({ libraryId }) {
  const { user, isPrimaryLibrarianOf } = useAuth();
  const { showToast } = useToast();
  const isPrimaryLibrarian = isPrimaryLibrarianOf(libraryId);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await librariesApi.listMembers(libraryId, {
        status: filterStatus === 'ALL' ? undefined : filterStatus,
      });
      setMembers(res.members || []);
    } catch (err) {
      showToast(err.message || 'Failed to load library members.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [libraryId, filterStatus]);

  const handleUpdateStatus = async (memberId, newStatus) => {
    setActionLoadingId(memberId);
    try {
      await librariesApi.updateMember(libraryId, memberId, { status: newStatus });
      showToast(`Membership request ${newStatus.toLowerCase()}!`, 'success');
      loadMembers();
    } catch (err) {
      showToast(err.message || 'Failed to update membership status.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateRole = async (memberId, newRole) => {
    setActionLoadingId(memberId);
    try {
      await librariesApi.updateMember(libraryId, memberId, { role: newRole });
      showToast(`Member role updated to ${newRole}!`, 'success');
      loadMembers();
    } catch (err) {
      showToast(err.message || 'Failed to update member role.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusVariant = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
  };

  const roleVariant = {
    PRIMARY_LIBRARIAN: 'purple',
    LIBRARIAN: 'info',
    MEMBER: 'neutral',
  };

  return (
    <div className="space-y-6">
      {/* Filters & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 backdrop-blur-xs p-5 rounded-2xl border border-beige-300 shadow-warm">
        <div>
          <h4 className="font-serif text-base font-bold text-forest">Library Members Directory</h4>
          <p className="text-xs text-charcoal-muted mt-0.5">
            Review membership applications and assign librarian roles.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filterStatus === st
                  ? 'bg-forest text-ivory shadow-xs'
                  : 'bg-ivory/80 text-charcoal-muted hover:bg-beige-200 hover:text-forest'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner text="Loading members..." />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description={`There are no members currently in ${filterStatus} status.`}
        />
      ) : (
        <div className="bg-white/90 backdrop-blur-xs rounded-2xl border border-beige-300 overflow-hidden shadow-warm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-charcoal">
              <thead className="bg-ivory/80 text-forest font-serif font-bold border-b border-beige-300 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Locality / Address</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined / Applied</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige-200/60">
                {members.map((m) => {
                  const isActingOnSelf = Number(m.user_id) === Number(user?.id);
                  const isTargetPrimary = m.role === 'PRIMARY_LIBRARIAN';
                  const isBusy = actionLoadingId === m.id;

                  return (
                    <tr key={m.id} className="hover:bg-ivory/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-charcoal">{m.full_name}</p>
                        <p className="text-[11px] text-charcoal-muted">{m.email}</p>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-charcoal">
                        {m.society_locality || '—'}, {m.city || ''}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={roleVariant[m.role] || 'neutral'} size="sm">
                          {m.role}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={statusVariant[m.status] || 'neutral'} size="sm">
                          {m.status}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-right space-x-1.5">
                        {/* Approval / Rejection Controls for PENDING */}
                        {m.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={isBusy}
                              loading={isBusy}
                              onClick={() => handleUpdateStatus(m.id, 'APPROVED')}
                              icon={Check}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleUpdateStatus(m.id, 'REJECTED')}
                              className="text-rose-600 hover:bg-rose-50"
                              icon={X}
                            >
                              Reject
                            </Button>
                          </>
                        )}

                        {/* Primary Librarian Controls for Promoting/Demoting */}
                        {isPrimaryLibrarian && m.status === 'APPROVED' && !isTargetPrimary && !isActingOnSelf && (
                          <>
                            {m.role === 'MEMBER' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => handleUpdateRole(m.id, 'LIBRARIAN')}
                                icon={Shield}
                              >
                                Appoint Librarian
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isBusy}
                                onClick={() => handleUpdateRole(m.id, 'MEMBER')}
                                className="text-slate-500 hover:text-rose-600"
                              >
                                Demote to Member
                              </Button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
