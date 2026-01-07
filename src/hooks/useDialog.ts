import { useState, useCallback } from 'react';

export interface DialogOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export interface DialogState extends DialogOptions {
  isOpen: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export function useDialog() {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
  });

  const openDialog = useCallback((options: DialogOptions & { 
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
  }) => {
    setDialog({
      isOpen: true,
      ...options,
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  const confirm = useCallback(async () => {
    if (dialog.onConfirm) {
      await dialog.onConfirm();
    }
    closeDialog();
  }, [dialog.onConfirm, closeDialog]);

  const cancel = useCallback(() => {
    if (dialog.onCancel) {
      dialog.onCancel();
    }
    closeDialog();
  }, [dialog.onCancel, closeDialog]);

  // Convenience methods for common dialog types
  const showConfirmDialog = useCallback((options: {
    title: string;
    description?: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
  }) => {
    openDialog({
      ...options,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
    });
  }, [openDialog]);

  const showAlert = useCallback((options: {
    title: string;
    description?: string;
    onConfirm?: () => void;
    confirmText?: string;
  }) => {
    openDialog({
      ...options,
      confirmText: options.confirmText || 'OK',
      onConfirm: options.onConfirm,
    });
  }, [openDialog]);

  return {
    dialog,
    openDialog,
    closeDialog,
    confirm,
    cancel,
    showConfirmDialog,
    showAlert,
  };
}