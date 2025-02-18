import React from 'react';
import { Link } from 'react-router-dom';

export const GettingStarted: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to Ciro! 🎉
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Let's get you started with your AI-powered journey
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Start Guide
          </h2>
          <ul className="space-y-4">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 text-purple-600 mr-2">✓</span>
              <span className="text-gray-700 dark:text-gray-300">Account created and verified</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 text-purple-600 mr-2">1</span>
              <span className="text-gray-700 dark:text-gray-300">Explore the dashboard</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 text-purple-600 mr-2">2</span>
              <span className="text-gray-700 dark:text-gray-300">Create your first project</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 text-purple-600 mr-2">3</span>
              <span className="text-gray-700 dark:text-gray-300">Set up your preferences</span>
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Next Steps
          </h2>
          <div className="space-y-4">
            <Link
              to="/dashboard"
              className="block p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <h3 className="font-semibold text-purple-700 dark:text-purple-300">
                Go to Dashboard →
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                View your projects and analytics
              </p>
            </Link>
            
            <Link
              to="/profile"
              className="block p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <h3 className="font-semibold text-purple-700 dark:text-purple-300">
                Complete Your Profile →
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Customize your account settings
              </p>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-12 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Need help getting started?
        </p>
        <Link
          to="/support"
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}; 