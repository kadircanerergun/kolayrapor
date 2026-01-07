import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ModalState } from '@/hooks/useModal';
import { cn } from '@/utils/tailwind';

interface ModalProviderProps {
  modal: ModalState;
  onClose: () => void;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full w-full h-full m-0 rounded-none',
};

export function ModalProvider({ modal, onClose }: ModalProviderProps) {
  if (!modal.isOpen || !modal.content) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open && modal.closeOnOutsideClick) {
      onClose();
    }
  };

  return (
    <Dialog 
      open={modal.isOpen} 
      onOpenChange={handleOpenChange}
    >
      <DialogContent 
        className={cn(
          modal.size && sizeClasses[modal.size],
          modal.size === 'full' && 'h-full'
        )}
        onEscapeKeyDown={(e) => {
          if (!modal.closeOnEscape) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          if (!modal.closeOnOutsideClick) {
            e.preventDefault();
          }
        }}
      >
        {modal.title && (
          <DialogHeader>
            <DialogTitle>{modal.title}</DialogTitle>
          </DialogHeader>
        )}
        <div className={cn(
          'flex-1',
          modal.size === 'full' && 'overflow-auto'
        )}>
          {modal.content}
        </div>
      </DialogContent>
    </Dialog>
  );
}