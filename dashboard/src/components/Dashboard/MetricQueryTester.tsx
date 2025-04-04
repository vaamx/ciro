import React, { useState } from 'react';
import { Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useMetricData } from '../../hooks/useMetricData';
import type { MetricQueryConfig, MetricQueryResult } from '../../services/metricDataService';

interface MetricQueryTesterProps {
  dataSourceId: string;
  query: string;
  onQuerySuccess?: (result: MetricQueryResult) => void;
}

export const MetricQueryTester: React.FC<MetricQueryTesterProps> = ({
  dataSourceId,
  query,
  onQuerySuccess
}) => {
  const [testResult, setTestResult] = useState<MetricQueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const { testQuery } = useMetricData(undefined, { autoFetch: false });

  const runTestQuery = async () => {
    if (!dataSourceId || !query.trim()) {
      return;
    }

    setIsExecuting(true);
    
    try {
      const queryConfig: MetricQueryConfig = {
        dataSourceId,
        query: query.trim()
      };
      
      const result = await testQuery(queryConfig);
      setTestResult(result);
      
      if (!result.error && onQuerySuccess) {
        onQuerySuccess(result);
      }
    } catch (error) {
      console.error('Failed to execute test query:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const renderResult = () => {
    if (!testResult) return null;

    if (testResult.error) {
      return (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Query Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                {testResult.error}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30 rounded-lg">
        <div className="flex items-start">
          <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Query Success
            </p>
            <div className="flex items-center gap-4 mt-1">
              <div>
                <p className="text-xs text-green-700 dark:text-green-400">Value</p>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  {testResult.value}
                </p>
              </div>
              {testResult.trend !== undefined && (
                <div>
                  <p className="text-xs text-green-700 dark:text-green-400">Trend</p>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    {testResult.trend > 0 ? '+' : ''}{testResult.trend}%
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-green-700 dark:text-green-400">Updated</p>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  {new Date(testResult.lastUpdated).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Test Query
        </p>
        <button
          type="button"
          onClick={runTestQuery}
          disabled={isExecuting || !dataSourceId || !query.trim()}
          className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-medium 
          ${isExecuting || !dataSourceId || !query.trim() ? 
            'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' :
            'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
          }`}
        >
          <Play className={`w-3.5 h-3.5 mr-1.5 ${isExecuting ? 'animate-pulse' : ''}`} />
          {isExecuting ? 'Running...' : 'Run Test'}
        </button>
      </div>
      {renderResult()}
    </div>
  );
}; 