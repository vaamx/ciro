import React, { useState } from 'react';
import { Mail, LucideProps } from 'lucide-react';
import { API_URL } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const MailIcon = Mail as React.FC<LucideProps>;

interface VerificationPendingProps {
  email: string;
}

export const VerificationPending: React.FC<VerificationPendingProps> = ({ email }) => {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendMessage(null);
    setResendError(null);

    try {
      // Validate email format before sending
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setResendError('Invalid email format');
        return;
      }

      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          email: email.toLowerCase().trim() 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendMessage(data.message || 'Verification email has been resent. Please check your inbox.');
      } else {
        setResendError(data.message || data.error || 'Failed to resend verification email');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      setResendError('Failed to resend verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto text-center">
      <div className="mb-8">
        <div className="bg-purple-100 dark:bg-purple-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <MailIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Check your email
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          We've sent a verification link to:
        </p>
        <p className="text-lg font-medium text-gray-900 dark:text-white mt-2">
          {email}
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 mb-8">
        <h2 className="font-medium text-gray-900 dark:text-white mb-4">
          Next steps:
        </h2>
        <ol className="text-left space-y-4 text-gray-600 dark:text-gray-400">
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-3 mt-0.5">
              1
            </span>
            <span>Click the verification link in your email</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-3 mt-0.5">
              2
            </span>
            <span>You'll be automatically logged in</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-3 mt-0.5">
              3
            </span>
            <span>Complete your profile and get started!</span>
          </li>
        </ol>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>Didn't receive the email? Check your spam folder or</p>
        <button
          onClick={handleResendVerification}
          disabled={isResending}
          className="text-purple-600 hover:text-purple-500 font-medium mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isResending ? 'Sending...' : 'Click here to resend'}
        </button>
        {resendMessage && (
          <p className="mt-2 text-green-600 dark:text-green-400">{resendMessage}</p>
        )}
        {resendError && (
          <p className="mt-2 text-red-600 dark:text-red-400">{resendError}</p>
        )}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Link
            to="/login"
            className="text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}; 