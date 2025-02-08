import React, { useState } from 'react';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  Filter,
  X,
  Check,
  Eye
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  source: 'system' | 'automation' | 'integration' | 'security';
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'success',
    title: 'Data Sync Complete',
    message: 'Successfully synced 1,234 records from Salesforce CRM',
    time: '2 mins ago',
    isRead: false,
    source: 'integration'
  },
  {
    id: '2',
    type: 'warning',
    title: 'Automation Warning',
    message: 'Lead scoring automation encountered missing fields',
    time: '15 mins ago',
    isRead: false,
    source: 'automation'
  },
  {
    id: '3',
    type: 'error',
    title: 'Connection Failed',
    message: 'Failed to connect to PostgreSQL database',
    time: '1 hour ago',
    isRead: true,
    source: 'system'
  },
  {
    id: '4',
    type: 'info',
    title: 'Security Update',
    message: 'New security patch has been applied to all systems',
    time: '2 hours ago',
    isRead: true,
    source: 'security'
  }
];

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  isOpen,
  onClose
}) => {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'system', label: 'System' },
    { id: 'automation', label: 'Automations' },
    { id: 'integration', label: 'Integrations' },
    { id: 'security', label: 'Security' }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (showUnreadOnly && notification.isRead) return false;
    if (activeFilter === 'all') return true;
    return notification.source === activeFilter;
  });

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, isRead: true } : n
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-lg">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-800">Notifications</h2>
              <span className="px-2 py-1 text-xs font-medium text-purple-600 bg-purple-100 rounded-full">
                {notifications.filter(n => !n.isRead).length} new
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-4 mb-4">
              <button
                onClick={markAllAsRead}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                Mark all as read
              </button>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="unreadOnly"
                  checked={showUnreadOnly}
                  onChange={(e) => setShowUnreadOnly(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="unreadOnly" className="text-sm text-gray-600">
                  Show unread only
                </label>
              </div>
            </div>

            <div className="flex space-x-2 overflow-x-auto pb-2">
              {filters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                    activeFilter === filter.id
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Bell className="w-12 h-12 mb-4 text-gray-300" />
                <p className="text-lg font-medium">No notifications</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredNotifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.isRead ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-xs text-gray-400">
                            {notification.time}
                          </span>
                          {!notification.isRead && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs text-purple-600 hover:text-purple-700 flex items-center space-x-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Mark as read</span>
                            </button>
                          )}
                          <button className="text-xs text-gray-400 hover:text-gray-600 flex items-center space-x-1">
                            <Eye className="w-3 h-3" />
                            <span>View details</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 