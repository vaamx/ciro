import React from 'react';
import { MessageSquareIcon, ArrowRightIcon } from 'lucide-react';

export interface WelcomeScreenProps {
  onSendMessage: (message: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSendMessage }) => {
  // Example prompts that users can click on
  const examplePrompts = [
    "Analyze our quarterly sales data and show me the trends",
    "Summarize the key points from our annual report",
    "Create a visualization of our customer demographics"
  ];

  // Feature categories with icons and descriptions
  const features = [
    {
      icon: "📊",
      title: "Data Analysis",
      items: ["Analyze datasets", "Find patterns", "Generate reports"]
    },
    {
      icon: "🔍",
      title: "Knowledge Base",
      items: ["Search documents", "Extract information", "Answer questions"]
    },
    {
      icon: "💡",
      title: "Creative Assistance",
      items: ["Generate ideas", "Brainstorm solutions", "Draft content"]
    }
  ];

  return (
    <div className="flex flex-col justify-center items-center h-full overflow-auto bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl w-full mx-auto px-6 flex flex-col justify-center items-center py-8">
        {/* Centered welcome header with improved styling */}
        <div className="text-center mb-8">
          <div className="mb-5 bg-gradient-to-br from-purple-500 to-indigo-600 p-4 rounded-2xl shadow-lg inline-flex transform hover:scale-105 transition-all duration-300 hover:shadow-purple-300/20 dark:hover:shadow-purple-500/20">
            <MessageSquareIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 mb-3">
            Welcome to your AI Assistant!
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
            I'm here to help you analyze data, answer questions, and generate insights.
          </p>
        </div>

        {/* Features in a more compact grid layout */}
        <div className="w-full max-w-3xl mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-800/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 dark:border-gray-700/50 transform hover:-translate-y-1"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  backdropFilter: 'blur(8px)'
                }}
              >
                <div className="text-2xl mb-2">{feature.icon}</div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <ul className="text-left text-xs text-gray-600 dark:text-gray-300 space-y-1.5">
                  {feature.items.map((item, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-purple-500 mr-1.5 text-lg">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Example prompts with enhanced styling and interactions */}
        <div className="w-full max-w-2xl">
          <h3 className="text-sm font-medium text-center text-gray-800 dark:text-gray-200 mb-3">
            Try asking me:
          </h3>
          <div className="space-y-2.5">
            {examplePrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => onSendMessage(prompt)}
                className="group w-full text-left p-3 bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-xl text-gray-700 dark:text-gray-200 transition-all duration-200 border border-gray-200 dark:border-gray-700/50 hover:border-purple-200 dark:hover:border-purple-700 text-sm shadow-sm hover:shadow-md"
                style={{ 
                  animationDelay: `${index * 150 + 300}ms`,
                  backdropFilter: 'blur(8px)'
                }}
              >
                <div className="flex items-center">
                  <span className="mr-2 text-purple-500 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                  <span>"{prompt}"</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 