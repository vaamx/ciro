import React, { useState, useEffect } from 'react';
import { RagService } from '../services/rag/RagService';
import { hasOpenAIApiKey, setOpenAIApiKey, fetchApiKeyFromServer } from '../utils/set-api-key';
import { testApiKey } from '../utils/test-api-key';
import { ApiKeyDiagnostics } from './ApiKeyDiagnostics';

interface ApiKeyFormProps {
  onSuccess?: () => void;
}

// Define a type for the test result that accommodates both formats
interface ApiKeyTestResult {
  success: boolean;
  message?: string;
  error?: string;
}

export const ApiKeyForm: React.FC<ApiKeyFormProps> = ({ onSuccess }) => {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with loading state
  const [testResult, setTestResult] = useState<ApiKeyTestResult | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [serverKeyAvailable, setServerKeyAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // First try to fetch the API key from the server
    const getServerKey = async () => {
      try {
        const serverKey = await fetchApiKeyFromServer();
        if (serverKey) {
          setServerKeyAvailable(true);
          setHasKey(true);
          setSuccess(true);
          if (onSuccess) {
            onSuccess();
          }
        } else {
          setServerKeyAvailable(false);
          // Fall back to checking local storage
          setHasKey(hasOpenAIApiKey() || RagService.hasApiKey());
        }
      } catch (error) {
        console.error('Error fetching server API key:', error);
        setServerKeyAvailable(false);
        // Fall back to checking local storage
        setHasKey(hasOpenAIApiKey() || RagService.hasApiKey());
      } finally {
        setIsLoading(false);
      }
    };

    getServerKey();
  }, [onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setTestResult(null);
    setIsLoading(true);

    if (!apiKey || apiKey.trim() === '') {
      setError('Please enter a valid API key');
      setIsLoading(false);
      return;
    }

    try {
      // Test the API key before saving it
      const result = await testApiKey(apiKey);
      setTestResult(result);
      
      if (result.success) {
        // Set the API key
        setOpenAIApiKey(apiKey);
        
        setSuccess(true);
        setHasKey(true);
        setApiKey('');
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(result.error || 'API key validation failed');
      }
    } catch (error) {
      setError('Error setting API key: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestKey = async () => {
    if (!apiKey || apiKey.trim() === '') {
      setError('Please enter a valid API key');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testApiKey(apiKey);
      setTestResult(result);
      
      if (!result.success) {
        setError(result.error || 'API key validation failed');
      }
    } catch (error) {
      setError('Error testing API key: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">OpenAI API Key Configuration</h2>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading API key configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">OpenAI API Key Configuration</h2>
      
      {serverKeyAvailable && (
        <div className="mb-4 p-2 bg-green-50 text-green-700 rounded">
          <p>✅ Using the OpenAI API key configured on the server.</p>
          <p className="text-sm mt-1">No additional configuration needed.</p>
        </div>
      )}
      
      {!serverKeyAvailable && hasKey && (
        <div className="mb-4 p-2 bg-green-50 text-green-700 rounded">
          <p>✅ An OpenAI API key is already configured in your browser.</p>
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-700 rounded">
          <p>{error}</p>
          <button 
            onClick={() => setShowDiagnostics(true)}
            className="text-sm text-blue-600 hover:underline mt-1"
          >
            Run diagnostics
          </button>
        </div>
      )}
      
      {testResult && testResult.success && (
        <div className="mb-4 p-2 bg-green-50 text-green-700 rounded">
          <p>✅ {testResult.message}</p>
        </div>
      )}
      
      {success && !serverKeyAvailable && (
        <div className="mb-4 p-2 bg-green-50 text-green-700 rounded">
          <p>API key set successfully!</p>
        </div>
      )}
      
      {showDiagnostics ? (
        <ApiKeyDiagnostics onClose={() => setShowDiagnostics(false)} />
      ) : (
        <>
          {!serverKeyAvailable && (
            <>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your OpenAI API key"
                    required
                    disabled={isLoading}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Your API key is stored locally in your browser and is never sent to our servers.
                  </p>
                </div>
                
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handleTestKey}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Testing...' : 'Test Key'}
                  </button>
                  
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : 'Save API Key'}
                  </button>
                </div>
              </form>
              
              <div className="mt-4 text-sm text-gray-600">
                <p>
                  Don't have an OpenAI API key? You can get one from{' '}
                  <a 
                    href="https://platform.openai.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    OpenAI's website
                  </a>.
                </p>
              </div>
            </>
          )}
          
          <p className="mt-2 text-sm text-gray-600">
            <button 
              type="button" 
              onClick={() => setShowDiagnostics(true)}
              className="text-blue-600 hover:underline"
            >
              Having trouble? Run API key diagnostics
            </button>
          </p>
        </>
      )}
    </div>
  );
}; 