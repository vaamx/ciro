import React from 'react';
import { MessageSquare } from 'lucide-react';

export const ChatbotPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Customer Chatbots</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Connect your data sources to customer-facing chatbots. Allow your customers to interact via WhatsApp or embedded website chats with a custom knowledge base tailored to your business.
        </p>
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800/50">
          <p className="text-yellow-800 dark:text-yellow-400 text-sm">
            This feature is coming soon. We're working hard to bring you intelligent customer-facing chatbots.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage; 