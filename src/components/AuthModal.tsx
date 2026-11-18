import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthFlowCard } from './auth/AuthFlowCard';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: 'login' | 'register';
  onClose: () => void;
  onSuccess?: () => void;
  promptReason?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialTab = 'login',
  onClose,
  onSuccess,
  promptReason,
}) => {
  const { authPromptReason, closeAuthGateModal } = useAuth();

  if (!isOpen) return null;

  const handleClose = () => {
    closeAuthGateModal();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[460px] rounded-3xl bg-[var(--bg)] border border-[var(--border-strong)] p-5 sm:p-6 shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <AuthFlowCard
          initialMode={initialTab === 'register' ? 'register' : 'welcome'}
          promptReason={promptReason || authPromptReason}
          showCloseButton
          onClose={handleClose}
          onBrowseGuest={handleClose}
          onSuccess={() => {
            onSuccess?.();
            handleClose();
          }}
        />
      </div>
    </div>
  );
};
