import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-terracotta-50 border border-terracotta-200 text-terracotta-900 text-sm">
          <AlertTriangle className="w-5 h-5 text-terracotta shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-beige-200">
          <Button variant="outline" size="md" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant} size="md" onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
