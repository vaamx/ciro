import { useState, useEffect, useCallback } from 'react';
import { metricDataService, MetricQueryConfig, MetricQueryResult } from '../services/metricDataService';

interface UseMetricDataOptions {
  autoFetch?: boolean;
  refreshInterval?: number;
}

export function useMetricData(config?: MetricQueryConfig, options: UseMetricDataOptions = {}) {
  const [result, setResult] = useState<MetricQueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { autoFetch = true, refreshInterval } = options;

  const fetchData = useCallback(async (queryConfig?: MetricQueryConfig) => {
    if (!queryConfig && !config) {
      return;
    }

    const effectiveConfig = queryConfig || config;
    if (!effectiveConfig?.dataSourceId || !effectiveConfig?.query) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await metricDataService.executeQuery(effectiveConfig);
      setResult(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch metric data';
      setError(errorMessage);
      console.error('Error fetching metric data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  const testQuery = useCallback(async (queryConfig: MetricQueryConfig) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await metricDataService.testQuery(queryConfig);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test query';
      setError(errorMessage);
      console.error('Error testing query:', err);
      return {
        value: 'Error',
        error: errorMessage,
        lastUpdated: new Date().toISOString()
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (autoFetch && config?.dataSourceId && config?.query) {
      fetchData();
    }
  }, [autoFetch, config?.dataSourceId, config?.query, fetchData]);

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval || !autoFetch || !config?.dataSourceId || !config?.query) {
      return;
    }

    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoFetch, config?.dataSourceId, config?.query, fetchData, refreshInterval]);

  return {
    data: result,
    isLoading,
    error,
    fetchData,
    testQuery,
    refresh: () => fetchData(config)
  };
} 