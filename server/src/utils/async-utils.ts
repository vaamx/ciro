/**
 * Utility functions for asynchronous operations
 */

/**
 * Sleep for the specified number of milliseconds
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Run an async function with a timeout
 * @param asyncFn Async function to run
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutMessage Optional message for timeout error
 * @returns Promise that resolves with the function result or rejects on timeout
 */
export const withTimeout = async <T>(
  asyncFn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([asyncFn(), timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
};

/**
 * Retry an async function with exponential backoff
 * @param fn Async function to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelayMs Initial delay in milliseconds
 * @param maxDelayMs Maximum delay in milliseconds
 * @param shouldRetry Optional function to determine if error should be retried
 * @returns Promise that resolves with the function result or rejects after max retries
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000,
  maxDelayMs: number = 30000,
  shouldRetry: (error: unknown) => boolean = () => true
): Promise<T> => {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // If we've exhausted retries or shouldn't retry this error, rethrow
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        maxDelayMs,
        initialDelayMs * Math.pow(2, attempt)
      );
      const jitter = Math.random() * 0.1 * delay;
      await sleep(delay + jitter);
    }
  }
  
  // This should never be reached because of the throw inside the loop
  // But TypeScript needs it for type safety
  throw lastError;
};

/**
 * Run an async function with semaphore-based concurrency limiting
 * @param tasks Array of async tasks to execute
 * @param maxConcurrency Maximum number of concurrent tasks
 * @returns Promise that resolves when all tasks are complete
 */
export const withConcurrencyLimit = async <T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrency: number
): Promise<T[]> => {
  const results: T[] = [];
  let currentIndex = 0;
  let runningTasks = 0;
  
  return new Promise((resolve, reject) => {
    const startNextTask = () => {
      // If no more tasks, resolve when all running tasks complete
      if (currentIndex >= tasks.length && runningTasks === 0) {
        resolve(results);
        return;
      }
      
      // If at concurrency limit or no more tasks, wait
      if (runningTasks >= maxConcurrency || currentIndex >= tasks.length) {
        return;
      }
      
      // Start next task
      const taskIndex = currentIndex++;
      runningTasks++;
      
      tasks[taskIndex]()
        .then(result => {
          results[taskIndex] = result;
          runningTasks--;
          // Start next task
          startNextTask();
        })
        .catch(error => {
          reject(error);
        });
      
      // Try to start more tasks if possible
      startNextTask();
    };
    
    // Start initial tasks
    for (let i = 0; i < Math.min(maxConcurrency, tasks.length); i++) {
      startNextTask();
    }
  });
};

/**
 * Run a series of async operations in sequence
 * @param operations Array of async operations
 * @returns Promise that resolves when all operations complete in sequence
 */
export const sequentialAsync = async <T>(
  operations: Array<() => Promise<T>>
): Promise<T[]> => {
  const results: T[] = [];
  
  for (const operation of operations) {
    results.push(await operation());
  }
  
  return results;
}; 