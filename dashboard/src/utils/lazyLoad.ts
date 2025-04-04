import React, { ComponentType } from 'react';

/**
 * Creates a lazily loaded component
 * @param importFunc - Dynamic import function for the component
 * @returns Lazy loaded component
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(importFunc);
} 