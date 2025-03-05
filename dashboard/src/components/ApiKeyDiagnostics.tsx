import React, { useState, useEffect } from 'react';
import { diagnoseApiKeyIssues, fixCommonApiKeyIssues, testServerApiKeyAndUpdateDiagnostics } from '../utils/api-key-diagnostics';
import { setOpenAIApiKey, fetchApiKeyFromServer } from '../utils/set-api-key';

interface ApiKeyDiagnosticsProps {
  onClose?: () => void;
}

export const ApiKeyDiagnostics: React.FC<ApiKeyDiagnosticsProps> = ({ onClose }) => {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [manualApiKey, setManualApiKey] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fixResult, setFixResult] = useState<string | null>(null);

  useEffect(() => {
    // Run diagnostics on mount
    runFullDiagnostics();
  }, []);

  const runFullDiagnostics = async () => {
    setIsLoading(true);
    try {
      // Get basic diagnostics
      let result = diagnoseApiKeyIssues();
      
      // Test server API key
      result = await testServerApiKeyAndUpdateDiagnostics(result);
      
      setDiagnostics(result);
    } catch (error) {
      console.error('Error running diagnostics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunDiagnostics = () => {
    setFixResult(null);
    runFullDiagnostics();
  };

  const handleFixIssues = () => {
    setIsFixing(true);
    setFixResult(null);
    
    try {
      const fixed = fixCommonApiKeyIssues();
      
      if (fixed) {
        setFixResult('Some issues were automatically fixed. Please try your request again.');
      } else {
        setFixResult('No issues were automatically fixed. You may need to set your API key manually.');
      }
      
      // Run diagnostics again
      runFullDiagnostics();
    } catch (error) {
      setFixResult(`Error fixing issues: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleSetApiKey = () => {
    if (!manualApiKey.trim()) {
      setFixResult('Please enter a valid API key');
      return;
    }
    
    setIsFixing(true);
    setFixResult(null);
    
    try {
      const success = setOpenAIApiKey(manualApiKey);
      
      if (success) {
        setFixResult('API key set successfully. Please try your request again.');
        setManualApiKey('');
        
        // Run diagnostics again
        runFullDiagnostics();
      } else {
        setFixResult('Failed to set API key. Please try again.');
      }
    } catch (error) {
      setFixResult(`Error setting API key: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleFetchServerKey = async () => {
    setIsFixing(true);
    setFixResult(null);
    
    try {
      const serverKey = await fetchApiKeyFromServer();
      
      if (serverKey) {
        setFixResult('Server API key fetched and set successfully.');
        
        // Run diagnostics again
        runFullDiagnostics();
      } else {
        setFixResult('No API key available from server. You may need to set your API key manually.');
      }
    } catch (error) {
      setFixResult(`Error fetching server API key: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFixing(false);
    }
  };

  if (isLoading && !diagnostics) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">API Key Diagnostics</h2>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Running diagnostics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">API Key Diagnostics</h2>
      
      {diagnostics && (
        <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
          <h3 className="font-medium mb-2">Diagnostic Results:</h3>
          <ul className="space-y-1 text-sm">
            <li>
              <span className="font-medium">OpenAI API Key Present:</span>{' '}
              {diagnostics.hasOpenAIKey ? (
                <span className="text-green-600">Yes</span>
              ) : (
                <span className="text-red-600">No</span>
              )}
            </li>
            {diagnostics.hasOpenAIKey && (
              <>
                <li>
                  <span className="font-medium">Source:</span> {diagnostics.openAIKeySource}
                </li>
                <li>
                  <span className="font-medium">Key Length:</span> {diagnostics.openAIKeyLength} characters
                </li>
              </>
            )}
            <li>
              <span className="font-medium">Server API Key Available:</span>{' '}
              {diagnostics.serverKeyTested ? (
                diagnostics.serverKeyAvailable ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-red-600">No</span>
                )
              ) : (
                <span className="text-yellow-600">Not tested</span>
              )}
            </li>
            {diagnostics.errors.length > 0 && (
              <li>
                <span className="font-medium text-red-600">Errors:</span>
                <ul className="ml-4 list-disc">
                  {diagnostics.errors.map((error: string, index: number) => (
                    <li key={index} className="text-red-600">{error}</li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </div>
      )}
      
      {fixResult && (
        <div className={`mb-4 p-2 rounded ${fixResult.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
          <p>{fixResult}</p>
        </div>
      )}
      
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={handleRunDiagnostics}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isFixing || isLoading}
        >
          {isLoading ? 'Running...' : 'Run Diagnostics'}
        </button>
        
        <button
          onClick={handleFixIssues}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isFixing || isLoading}
        >
          {isFixing ? 'Fixing...' : 'Try Auto-Fix'}
        </button>
        
        <button
          onClick={handleFetchServerKey}
          className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isFixing || isLoading}
        >
          {isFixing ? 'Fetching...' : 'Fetch Server Key'}
        </button>
      </div>
      
      <div className="mb-4">
        <h3 className="font-medium mb-2">Manually Set API Key:</h3>
        <div className="flex">
          <input
            type="password"
            value={manualApiKey}
            onChange={(e) => setManualApiKey(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your OpenAI API key"
            disabled={isFixing || isLoading}
          />
          <button
            onClick={handleSetApiKey}
            className="px-3 py-2 bg-blue-600 text-white rounded-r hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isFixing || isLoading || !manualApiKey.trim()}
          >
            Set Key
          </button>
        </div>
      </div>
      
      {onClose && (
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}; 