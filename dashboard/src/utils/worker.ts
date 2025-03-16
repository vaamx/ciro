/**
 * Utility for creating and managing web workers for heavy processing tasks
 */

// Type definitions for worker messages
export interface WorkerMessage {
  id: string;
  type: string;
  payload: any;
}

export interface WorkerResponse {
  id: string;
  type: string;
  result?: any;
  error?: string;
}

// Map to store pending worker promises
const pendingTasks = new Map<
  string, 
  { resolve: (value: any) => void; reject: (reason: any) => void }
>();

/**
 * Creates a worker and handles communication with it
 * @param workerScript - Path to the worker script
 * @returns Object with methods to interact with the worker
 */
export function createWorker(workerScript: string) {
  // Create a worker instance
  const worker = new Worker(workerScript);
  
  // Set up message handler
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const { id, result, error } = event.data;
    
    // Find the pending task
    const task = pendingTasks.get(id);
    if (task) {
      if (error) {
        task.reject(new Error(error));
      } else {
        task.resolve(result);
      }
      pendingTasks.delete(id);
    }
  };
  
  // Handle worker errors
  worker.onerror = (error) => {
    console.error('Worker error:', error);
  };
  
  return {
    /**
     * Sends a task to the worker and returns a promise
     * @param type - Task type
     * @param payload - Task data
     * @returns Promise that resolves with the worker result
     */
    executeTask<T>(type: string, payload: any): Promise<T> {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        
        // Store the promise callbacks
        pendingTasks.set(id, { resolve, reject });
        
        // Send the message to the worker
        worker.postMessage({ id, type, payload });
      });
    },
    
    /**
     * Terminates the worker
     */
    terminate() {
      worker.terminate();
      
      // Reject all pending tasks
      for (const [id, { reject }] of pendingTasks.entries()) {
        reject(new Error('Worker terminated'));
        pendingTasks.delete(id);
      }
    }
  };
} 