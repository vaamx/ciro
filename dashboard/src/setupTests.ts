// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
import '@testing-library/jest-dom';

// Import Jest globals
import { jest } from '@jest/globals';

// Mock the Worker API
class MockWorker implements Partial<Worker> {
  onmessage: ((this: Worker, ev: MessageEvent) => any) | null = null;
  onmessageerror: ((this: Worker, ev: MessageEvent) => any) | null = null;
  addEventListener(_type: string, _listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions): void {}
  removeEventListener(_type: string, _listener: EventListenerOrEventListenerObject, _options?: boolean | EventListenerOptions): void {}
  dispatchEvent(_event: Event): boolean { return false; }
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null = null;
  postMessage(message: any): void {
    // Simulate worker response
    if (this.onmessage) {
      setTimeout(() => {
        const event = { data: message } as MessageEvent;
        if (this.onmessage) {
          this.onmessage(event);
        }
      }, 0);
    }
  }
  terminate(): void {}
}

// Mock the global Worker constructor
global.Worker = MockWorker as any;

// Mock the ResizeObserver
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = MockResizeObserver as any;

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.IntersectionObserver = MockIntersectionObserver as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: unknown) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock navigator properties
Object.defineProperty(global.navigator, 'deviceMemory', {
  writable: true,
  value: 8,
});

Object.defineProperty(global.navigator, 'hardwareConcurrency', {
  writable: true,
  value: 4,
});

// Suppress console errors during tests
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
      args[0].includes('Warning: React.createFactory()') ||
      args[0].includes('Warning: Using UNSAFE_') ||
      args[0].includes('Warning: `ReactDOMTestUtils.act` is deprecated') ||
      args[0].includes('Warning: unmountComponentAtNode is deprecated'))
  ) {
    return;
  }
  originalConsoleError(...args);
}; 