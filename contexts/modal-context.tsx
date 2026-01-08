/**
 * Modal Context
 * 
 * Centralized modal state management to reduce prop drilling and simplify modal handling.
 * 
 * **Why use a Modal Context?**
 * - Reduces prop drilling (no need to pass modal state through multiple components)
 * - Centralized modal state (easier to debug and manage)
 * - Consistent modal behavior across the app
 * - Can add features like modal stacking, history, etc.
 * 
 * **Usage:**
 * ```tsx
 * const { openModal, closeModal, isModalOpen } = useModal();
 * 
 * // Open a modal
 * openModal('addPerson', { personId: '123' });
 * 
 * // Close current modal
 * closeModal();
 * 
 * // Check if specific modal is open
 * if (isModalOpen('addPerson')) { ... }
 * ```
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ModalType = 
  | 'addPerson'
  | 'editProfile'
  | 'addUpdate'
  | 'addRelativeOrStory'
  | 'addRelativeType'
  | 'editUpdate'
  | 'locationInput'
  | 'deleteConfirm';

export interface ModalState {
  type: ModalType | null;
  props?: Record<string, any>;
}

interface ModalContextType {
  /** Current modal state */
  modal: ModalState;
  /** Open a modal with optional props */
  openModal: (type: ModalType, props?: Record<string, any>) => void;
  /** Close the current modal */
  closeModal: () => void;
  /** Check if a specific modal is open */
  isModalOpen: (type: ModalType) => boolean;
  /** Check if any modal is open */
  hasOpenModal: boolean;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ type: null });

  const openModal = useCallback((type: ModalType, props?: Record<string, any>) => {
    setModal({ type, props });
  }, []);

  const closeModal = useCallback(() => {
    setModal({ type: null });
  }, []);

  const isModalOpen = useCallback((type: ModalType) => {
    return modal.type === type;
  }, [modal.type]);

  const hasOpenModal = modal.type !== null;

  return (
    <ModalContext.Provider
      value={{
        modal,
        openModal,
        closeModal,
        isModalOpen,
        hasOpenModal,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}

