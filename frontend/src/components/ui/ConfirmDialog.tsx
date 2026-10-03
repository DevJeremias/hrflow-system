import React from 'react';
import Button from './Button';
import Modal from './Modal';

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

// A ação segura (cancelar) é a que recebe o foco: Enter sem querer nunca confirma uma exclusão.
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'default', onConfirm, onCancel }) => (
  <Modal
    title={title}
    description={description}
    size="sm"
    onClose={onCancel}
    footer={(
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} data-autofocus>{cancelLabel}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    )}
  />
);

export default ConfirmDialog;
