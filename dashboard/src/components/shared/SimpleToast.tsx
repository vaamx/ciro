// SimpleToast.tsx - Simple toast notifications using the DOM
// No React imports needed since we're using pure JS

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

// DOM element to attach the toast to
let toastContainer: HTMLDivElement | null = null;

// Create toast container if it doesn't exist
const getToastContainer = () => {
  if (typeof document === 'undefined') return null;
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '20px';
    toastContainer.style.left = '50%';
    toastContainer.style.transform = 'translateX(-50%)';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
  
  return toastContainer;
};

/**
 * Show a toast notification
 */
export const showToast = ({ message, type = 'info', duration = 3000 }: ToastOptions) => {
  const container = getToastContainer();
  if (!container) return;
  
  // Create toast element
  const toastEl = document.createElement('div');
  toastEl.className = 'animate-fade-in';
  
  // Style based on type
  const bgColorClass = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  }[type];
  
  const textColorClass = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    warning: 'text-amber-800 dark:text-amber-200',
    info: 'text-blue-800 dark:text-blue-200'
  }[type];
  
  // Icon HTML
  const iconHTML = {
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>'
  }[type];

  // Set toast HTML
  toastEl.innerHTML = `
    <div class="flex items-center p-4 mb-3 rounded-lg shadow-lg border ${bgColorClass} max-w-md">
      <div class="flex-shrink-0">
        ${iconHTML}
      </div>
      <div class="ml-3 mr-8 font-medium ${textColorClass}">
        ${message}
      </div>
      <button
        type="button"
        class="absolute right-1 top-1 p-1.5 rounded-lg
              text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 
              hover:bg-gray-100 dark:hover:bg-gray-700"
        onclick="this.parentElement.remove()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
      </button>
    </div>
  `;
  
  // Add to container
  container.appendChild(toastEl);
  
  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (toastEl.parentNode === container) {
        toastEl.classList.replace('animate-fade-in', 'animate-fade-out');
        setTimeout(() => {
          if (toastEl.parentNode === container) {
            container.removeChild(toastEl);
          }
        }, 300); // Match animation duration
      }
    }, duration);
  }
  
  return toastEl;
}; 