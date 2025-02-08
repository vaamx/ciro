import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const stateParam = params.get('state');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      console.log('OAuth Callback received:', { code, stateParam, error, errorDescription });

      if (error) {
        console.error('OAuth Error:', error, errorDescription);
        window.opener?.postMessage({
          type: 'oauth-error',
          error: errorDescription || error
        }, window.location.origin);
        setTimeout(() => window.close(), 2000); // Increased delay to ensure message is sent
        return;
      }

      if (!code || !stateParam) {
        console.error('Missing code or state:', { code, stateParam });
        window.opener?.postMessage({
          type: 'oauth-error',
          error: 'No authorization code or state received'
        }, window.location.origin);
        setTimeout(() => window.close(), 2000);
        return;
      }

      try {
        let stateData;
        try {
          stateData = JSON.parse(decodeURIComponent(stateParam));
          console.log('Parsed state data:', stateData);
        } catch (e) {
          console.error('Failed to parse state:', e);
          window.opener?.postMessage({
            type: 'oauth-error',
            error: 'Invalid state parameter'
          }, window.location.origin);
          setTimeout(() => window.close(), 2000);
          return;
        }

        console.log('Exchanging code for token:', { code, state: stateData.state });

        // Exchange the code for tokens through our backend
        const response = await fetch('/api/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            state: stateData.state,
            provider: stateData.provider
          }),
          credentials: 'include'
        });

        console.log('Token exchange response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Token exchange failed:', errorData);
          throw new Error(errorData.error || 'Failed to exchange token');
        }

        const data = await response.json();
        console.log('Token exchange successful:', data);
        
        // Send success message back to opener
        window.opener?.postMessage({
          type: 'oauth-success',
          code,
          state: stateData.state,
          provider: stateData.provider
        }, window.location.origin);

        // Show success message before closing
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
          statusElement.textContent = 'Successfully connected! Closing window...';
        }
        
        // Close the window after a longer delay to ensure the message is sent
        setTimeout(() => window.close(), 2000);
      } catch (error) {
        console.error('Callback error:', error);
        window.opener?.postMessage({
          type: 'oauth-error',
          error: error instanceof Error ? error.message : 'Failed to exchange token'
        }, window.location.origin);
        
        // Show error message before closing
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
          statusElement.textContent = 'Connection failed. Closing window...';
        }
        
        setTimeout(() => window.close(), 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Completing authentication...</p>
        <p id="status-message" className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          This window will close automatically.
        </p>
      </div>
    </div>
  );
}; 