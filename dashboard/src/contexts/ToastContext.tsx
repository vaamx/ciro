import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Toast, ToastType } from '../components/shared/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

// Create the context with a default value
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Custom hook to use the toast context
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

// Toast provider component
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    duration: number;
    isVisible: boolean;
    id: number;
  } | null>(null);

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    // Generate a unique ID for the toast to ensure re-rendering even with the same message
    setToast({
      message,
      type,
      duration,
      isVisible: true,
      id: Date.now()
    });
  };

  const hideToast = () => {
    if (toast) {
      setToast({ ...toast, isVisible: false });
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          isVisible={toast.isVisible}
          onClose={hideToast}
          key={toast.id}
        />
      )}
    </ToastContext.Provider>
  );
};

export default ToastProvider; 