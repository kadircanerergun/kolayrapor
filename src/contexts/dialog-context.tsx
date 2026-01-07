import React, { createContext, useContext } from 'react';
import { useDialog, DialogOptions } from '@/hooks/useDialog';
import { DialogProvider } from '@/components/dialog-provider';

interface DialogContextValue {
  showAlert: (options: {
    title: string;
    description?: string;
    onConfirm?: () => void;
    confirmText?: string;
  }) => void;
  showConfirmDialog: (options: {
    title: string;
    description?: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
  }) => void;
  openDialog: (options: DialogOptions & { 
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
  }) => void;
  closeDialog: () => void;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export function DialogContextProvider({ children }: { children: React.ReactNode }) {
  const dialog = useDialog();

  const contextValue: DialogContextValue = {
    showAlert: dialog.showAlert,
    showConfirmDialog: dialog.showConfirmDialog,
    openDialog: dialog.openDialog,
    closeDialog: dialog.closeDialog,
  };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      <DialogProvider
        dialog={dialog.dialog}
        onConfirm={dialog.confirm}
        onCancel={dialog.cancel}
      />
    </DialogContext.Provider>
  );
}

export function useDialogContext() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialogContext must be used within a DialogContextProvider');
  }
  return context;
}