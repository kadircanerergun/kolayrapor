import { useState, useCallback, ReactNode } from 'react';

export interface ModalOptions {
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  showCloseButton?: boolean;
}

export interface ModalState extends ModalOptions {
  isOpen: boolean;
  content?: ReactNode;
  onClose?: () => void;
}

export function useModal() {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    closeOnEscape: true,
    closeOnOutsideClick: true,
    showCloseButton: true,
    size: 'md',
  });

  const openModal = useCallback((content: ReactNode, options?: ModalOptions & { onClose?: () => void }) => {
    setModal({
      isOpen: true,
      content,
      closeOnEscape: options?.closeOnEscape ?? true,
      closeOnOutsideClick: options?.closeOnOutsideClick ?? true,
      showCloseButton: options?.showCloseButton ?? true,
      size: options?.size ?? 'md',
      title: options?.title,
      onClose: options?.onClose,
    });
  }, []);

  const closeModal = useCallback(() => {
    if (modal.onClose) {
      modal.onClose();
    }
    setModal(prev => ({ ...prev, isOpen: false, content: null }));
  }, [modal.onClose]);

  // Convenience methods for common modal scenarios
  const showFormModal = useCallback((form: ReactNode, options?: ModalOptions & { onClose?: () => void }) => {
    openModal(form, {
      ...options,
      size: options?.size || 'lg',
    });
  }, [openModal]);

  const showContentModal = useCallback((content: ReactNode, options?: ModalOptions & { onClose?: () => void }) => {
    openModal(content, {
      ...options,
      size: options?.size || 'md',
    });
  }, [openModal]);

  const showFullScreenModal = useCallback((content: ReactNode, options?: ModalOptions & { onClose?: () => void }) => {
    openModal(content, {
      ...options,
      size: 'full',
      closeOnOutsideClick: false,
    });
  }, [openModal]);

  return {
    modal,
    openModal,
    closeModal,
    showFormModal,
    showContentModal,
    showFullScreenModal,
  };
}