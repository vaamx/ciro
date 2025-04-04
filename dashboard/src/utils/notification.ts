/**
 * Notification utility for displaying notifications to the user
 */

export interface NotificationOptions {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

// Keep track of active notifications for cleanup
let activeNotifications: HTMLElement[] = [];

/**
 * Display a notification to the user
 */
export function notification(options: NotificationOptions): void {
  // Default options
  const { type, message, duration = 3000 } = options;
  
  // Create the notification element
  const notificationElement = document.createElement('div');
  notificationElement.className = `
    fixed bottom-4 right-4 z-50
    p-4 rounded-lg shadow-md
    flex items-center space-x-3
    transform transition-all duration-300 ease-out
    translate-y-2 opacity-0
    ${type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200' : ''}
    ${type === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200' : ''}
    ${type === 'info' ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : ''}
    ${type === 'warning' ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' : ''}
  `;
  
  // Icon based on type
  let iconSvg = '';
  switch (type) {
    case 'success':
      iconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
      break;
    case 'error':
      iconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
      break;
    case 'info':
      iconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
      break;
    case 'warning':
      iconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
      break;
  }
  
  // Set the inner HTML
  notificationElement.innerHTML = `
    <div class="flex-shrink-0">
      ${iconSvg}
    </div>
    <div class="flex-1 text-sm font-medium">
      ${message}
    </div>
    <button class="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 focus:outline-none">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
  `;
  
  // Add to the DOM
  document.body.appendChild(notificationElement);
  activeNotifications.push(notificationElement);
  
  // Stagger multiple notifications
  const offset = (activeNotifications.length - 1) * 5;
  
  // Animate in
  setTimeout(() => {
    notificationElement.style.transform = `translateY(-${offset}px)`;
    notificationElement.style.opacity = '1';
  }, 10);
  
  // Add click handler to close button
  const closeButton = notificationElement.querySelector('button');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      removeNotification(notificationElement);
    });
  }
  
  // Auto-remove after duration
  setTimeout(() => {
    removeNotification(notificationElement);
  }, duration);
  
  // Helper to remove notification with animation
  function removeNotification(element: HTMLElement) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(10px)';
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      activeNotifications = activeNotifications.filter(n => n !== element);
      
      // Adjust positions of remaining notifications
      activeNotifications.forEach((notification, index) => {
        notification.style.transform = `translateY(-${index * 5}px)`;
      });
    }, 300);
  }
} 