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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Library Members Directory</h4>
          <p className="text-xs text-slate-500">
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
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Locality / Address</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined / Applied</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const isActingOnSelf = m.user_id === user?.id;
                  const isTargetPrimary = m.role === 'PRIMARY_LIBRARIAN';
                  const isBusy = actionLoadingId === m.id;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-slate-900">{m.full_name}</p>
                        <p className="text-[11px] text-slate-500">{m.email}</p>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
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
