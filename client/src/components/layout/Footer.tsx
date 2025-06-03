import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-100/50 dark:border-gray-800/50 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Customer Portal. All rights reserved.
          </div>
          
          <div className="flex space-x-6 mt-2 sm:mt-0">
            <Link 
              to="/help" 
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              Help
            </Link>
            <Link 
              to="/privacy" 
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              Privacy
            </Link>
            <Link 
              to="/terms" 
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              Terms
            </Link>
            <Link 
              to="/contact" 
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
} 