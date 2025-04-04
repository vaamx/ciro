import React from 'react';
import { Phone } from 'lucide-react';

export const VoicePage: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
          <Phone className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Voice Agents</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Configure voice agents for cold calling or automated answering systems powered by your own data sources.
          Create customized voice interactions to engage with your customers.
        </p>
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800/50">
          <p className="text-yellow-800 dark:text-yellow-400 text-sm">
            This feature is coming soon. We're developing intelligent voice agents to help you engage with your customers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoicePage; 