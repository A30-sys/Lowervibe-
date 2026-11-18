import React from 'react';
import { AuthFlowCard } from '../auth/AuthFlowCard';

interface AuthPortalViewProps {
  initialMode?: 'welcome' | 'login' | 'register' | 'forgot_password';
  onSuccess?: () => void;
}

export const AuthPortalView: React.FC<AuthPortalViewProps> = ({
  initialMode = 'welcome',
  onSuccess,
}) => {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col justify-center px-4 py-10">
      <AuthFlowCard initialMode={initialMode} onSuccess={onSuccess} />
    </div>
  );
};
