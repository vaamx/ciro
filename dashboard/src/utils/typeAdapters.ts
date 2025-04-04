import { DataSource as SharedDataSource } from '../types/shared-types';
import { DataSource as ComponentDataSource } from '../components/DataSources/types';

/**
 * Converts a shared-types DataSource to a component DataSource
 */
export function convertToComponentDataSource(source: SharedDataSource): ComponentDataSource {
  // Convert ErrorInfo to string if present
  let lastError = source.metrics.lastError;
  if (lastError && typeof lastError !== 'string') {
    lastError = lastError.message;
  }

  return {
    ...source,
    metrics: {
      ...source.metrics,
      lastError: lastError as string | undefined,
    }
  } as ComponentDataSource;
}

/**
 * Converts a component DataSource to a shared-types DataSource
 */
export function convertToSharedDataSource(source: ComponentDataSource): SharedDataSource {
  return source as unknown as SharedDataSource;
}

/**
 * Converts an array of shared-types DataSources to component DataSources
 */
export function convertArrayToComponentDataSources(sources: SharedDataSource[]): ComponentDataSource[] {
  return sources.map(convertToComponentDataSource);
}

/**
 * Safely converts between types using type assertions when needed
 * This is a temporary solution during migration
 */
export function safeTypeConversion<T, U>(value: T): U {
  return value as unknown as U;
} 