import React, { useEffect, useState } from 'react';
import { EventType, eventEmitter, ApiRateLimitExceededEvent } from '../../services/events';

interface RateLimitNotificationProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  autoHideDuration?: number;
}

const RateLimitNotification: React.FC<RateLimitNotificationProps> = ({
  position = 'top-center',
  autoHideDuration = 10000, // 10 seconds
}) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);
  const [countdownTimerId, setCountdownTimerId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Listen for rate limit exceeded events
    const unsubscribe = eventEmitter.on<ApiRateLimitExceededEvent>(
      EventType.API_RATE_LIMIT_EXCEEDED,
      (payload) => {
        setMessage(payload.message);
        setCountdown(Math.ceil(payload.retryAfter / 1000));
        setVisible(true);

        // Clear any existing timers
        if (timerId) clearTimeout(timerId);
        if (countdownTimerId) clearInterval(countdownTimerId);

        // Start countdown timer
        const newCountdownTimerId = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(newCountdownTimerId);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        setCountdownTimerId(newCountdownTimerId);

        // Auto-hide after duration
        const newTimerId = setTimeout(() => {
          setVisible(false);
        }, autoHideDuration);
        setTimerId(newTimerId);
      }
    );

    return () => {
      // Clean up event listener and timers
      unsubscribe();
      if (timerId) clearTimeout(timerId);
      if (countdownTimerId) clearInterval(countdownTimerId);
    };
  }, [autoHideDuration, timerId, countdownTimerId]);

  // Handle close button click
  const handleClose = () => {
    setVisible(false);
    if (timerId) clearTimeout(timerId);
    if (countdownTimerId) clearInterval(countdownTimerId);
  };

  // If not visible, don't render anything
  if (!visible) return null;

  // Position styles
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
    'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)' },
  };

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 9999,
        maxWidth: '400px',
        width: '100%',
        ...positionStyles[position],
      }}
    >
      <div
        style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '12px 20px',
          borderRadius: '4px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid #f5c6cb',
        }}
      >
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            Rate Limit Exceeded
          </div>
          <div>{message}</div>
          {countdown > 0 && (
            <div style={{ marginTop: '8px', fontSize: '0.9em' }}>
              Resuming in: {countdown} seconds
            </div>
          )}
        </div>
        <button
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#721c24',
            marginLeft: '10px',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default RateLimitNotification; 