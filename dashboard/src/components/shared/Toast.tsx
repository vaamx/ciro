import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
  isVisible: boolean;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  isVisible
}) => {
  const [isShowing, setIsShowing] = useState(isVisible);

  useEffect(() => {
    setIsShowing(isVisible);
    
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        setIsShowing(false);
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isShowing) return null;

  const iconMap = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  const bgColorMap = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  };

  const textColorMap = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    warning: 'text-amber-800 dark:text-amber-200',
    info: 'text-blue-800 dark:text-blue-200'
  };

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
      <div className={`flex items-center p-4 rounded-lg shadow-lg border ${bgColorMap[type]}`}>
        <div className="flex-shrink-0">
          {iconMap[type]}
        </div>
        <div className={`ml-3 mr-7 font-medium ${textColorMap[type]}`}>
          {message}
        </div>
        <button
          type="button"
          className="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex items-center justify-center h-8 w-8 
                     text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 
                     hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => {
            setIsShowing(false);
            if (onClose) onClose();
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Toast context for global toast management
interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    duration: number;
    isVisible: boolean;
    id: number;
  } | null>(null);

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    setToast({
      message,
      type,
      duration,
      isVisible: true,
      id: Date.now() // Unique ID to ensure re-render when showing the same message
    });
  };

  const handleClose = () => {
    setToast(prev => prev ? { ...prev, isVisible: false } : null);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={handleClose}
          isVisible={toast.isVisible}
          key={toast.id}
        />
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}; 