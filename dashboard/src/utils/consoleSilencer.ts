/**
 * Console Silencer Utility
 * 
 * This utility provides a way to completely disable console output in production builds,
 * while preserving the ability to log errors and warnings when absolutely necessary.
 * It's particularly useful for ensuring end users don't see any development logs.
 */

type ConsoleMethod = 'log' | 'info' | 'debug' | 'warn' | 'error';

// Store original console methods
const originalConsoleMethods: Record<ConsoleMethod, typeof console.log> = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error
};

// No-operation function
const noop = () => {};

/**
 * Silences all console methods except for specified ones
 * @param preserveMethods Array of console methods to preserve (leave functional)
 */
export function silenceConsole(preserveMethods: ConsoleMethod[] = ['error']): void {
  // Only apply in production environment
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  // Override each console method with noop unless it should be preserved
  Object.keys(originalConsoleMethods).forEach((method) => {
    const consoleMethod = method as ConsoleMethod;
    if (!preserveMethods.includes(consoleMethod)) {
      console[consoleMethod] = noop;
    }
  });
}

/**
 * Restores original console behavior
 */
export function restoreConsole(): void {
  Object.keys(originalConsoleMethods).forEach((method) => {
    const consoleMethod = method as ConsoleMethod;
    console[consoleMethod] = originalConsoleMethods[consoleMethod];
  });
}

/**
 * Creates a safe console that only logs in development mode
 * but is a no-op in production
 */
export const safeConsole = {
  log: (process.env.NODE_ENV === 'production') ? noop : console.log.bind(console),
  info: (process.env.NODE_ENV === 'production') ? noop : console.info.bind(console),
  debug: (process.env.NODE_ENV === 'production') ? noop : console.debug.bind(console),
  warn: (process.env.NODE_ENV === 'production') ? noop : console.warn.bind(console),
  // Always keep error logging
  error: console.error.bind(console)
}; 