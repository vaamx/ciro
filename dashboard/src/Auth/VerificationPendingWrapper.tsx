import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { VerificationPending } from './VerificationPending';

export const VerificationPendingWrapper: React.FC = () => {
  const location = useLocation();
  const email = location.state?.email;

  if (!email) {
    return <Navigate to="/signup" replace />;
  }

  return <VerificationPending email={email} />;
}; 