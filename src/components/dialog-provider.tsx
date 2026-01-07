import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DialogState } from '@/hooks/useDialog';

interface DialogProviderProps {
  dialog: DialogState;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DialogProvider({ dialog, onConfirm, onCancel }: DialogProviderProps) {
  if (!dialog || !dialog.isOpen) return null;

  return (
    <Dialog open={dialog.isOpen} onOpenChange={onCancel}>
      <DialogContent>
        {dialog.title && (
          <DialogHeader>
            <DialogTitle>{dialog.title}</DialogTitle>
            {dialog.description && (
              <DialogDescription>{dialog.description}</DialogDescription>
            )}
          </DialogHeader>
        )}

        <DialogFooter>
          {dialog.cancelText && (
            <Button variant="outline" onClick={onCancel}>
              {dialog.cancelText}
            </Button>
          )}
          <Button
            variant={dialog.variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {dialog.confirmText || 'OK'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}