import React from 'react';
import { Badge } from '../common/Badge';

export function BorrowStatusBadge({ status, queuePosition, size = 'md' }) {
  const config = {
    CUSTODIAN_APPROVAL_PENDING: {
      label: 'Custodian Approval Pending',
      variant: 'warning',
    },
    HANDOVER_PENDING: {
      label: 'Handover Pending',
      variant: 'info',
    },
    ACTIVE: {
      label: 'Active Loan',
      variant: 'success',
    },
    QUEUED: {
      label: queuePosition ? `Queued (#${queuePosition})` : 'Queued (Waitlist)',
      variant: 'purple',
    },
    RETURNED: {
      label: 'Returned',
      variant: 'neutral',
    },
    DECLINED: {
      label: 'Declined',
      variant: 'danger',
    },
    CANCELLED: {
      label: 'Cancelled',
      variant: 'neutral',
    },
    EXPIRED: {
      label: 'Expired',
      variant: 'danger',
    },
    FAILED: {
      label: 'Handover Failed',
      variant: 'danger',
    },
  }[status] || { label: status, variant: 'neutral' };

  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
}
