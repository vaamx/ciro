import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, LucideProps } from 'lucide-react';
import { API_URL, useAuth } from '../contexts/AuthContext';

interface VerificationStatus {
  success: boolean;
  message: string;
  redirectUrl?: string;
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

const LoaderIcon = Loader2 as React.FC<LucideProps>;
const CheckIcon = CheckCircle as React.FC<LucideProps>;
const ErrorIcon = XCircle as React.FC<LucideProps>;

export const VerifyEmailForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus({
          success: false,
          message: 'No verification token found. Please check your verification link.'
        });
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/verify-email?token=${token}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        const data = await response.json();

        if (response.ok) {
          // Set the user in auth context
          if (data.user) {
            setUser(data.user);
          }

          setStatus({
            success: true,
            message: data.message || 'Email verified successfully',
            redirectUrl: data.redirectUrl || '/getting-started',
            user: data.user
          });

          // Redirect after 3 seconds
          setTimeout(() => {
            navigate(data.redirectUrl || '/getting-started');
          }, 3000);
        } else {
          setStatus({
            success: false,
            message: data.error || data.message || 'Failed to verify email'
          });
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus({
          success: false,
          message: 'An error occurred during verification. Please try again.'
        });
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [searchParams, navigate, setUser]);

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto text-center p-8">
        <LoaderIcon className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Verifying your email
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please wait while we verify your email address...
        </p>
      </div>
    );
  }

  if (status?.success) {
    return (
      <div className="max-w-md mx-auto text-center p-8">
        <CheckIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Email Verified Successfully!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {status.message}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Redirecting you to get started...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto text-center p-8">
      <ErrorIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Verification Failed
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {status?.message || 'An error occurred during verification.'}
      </p>
      <div className="space-y-4">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          Try Again
        </button>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          If the problem persists, please request a new verification email from the verification pending page.
        </p>
      </div>
    </div>
  );
}; 