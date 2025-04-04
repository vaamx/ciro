import React, { useState } from 'react';
import { 
  Lightbulb, 
  TrendingUp, 
  AlertCircle, 
  Link, 
  BarChart2, 
  Calendar,
  Clock,
  ArrowRight,
  Download,
  Zap
} from 'lucide-react';

interface InsightCard {
  id: string;
  title: string;
  description: string;
  type: 'anomaly' | 'trend' | 'correlation';
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
}

const sampleInsights: InsightCard[] = [
  {
    id: "insight-1",
    title: "Unusual spike in order cancellations",
    description: "Order cancellation rate increased by 27% compared to the 90-day average",
    type: "anomaly",
    impact: "high",
    timestamp: "2 hours ago"
  },
  {
    id: "insight-2",
    title: "Strong correlation detected",
    description: "Product page visits and next-day sales show 89% correlation in the last 30 days",
    type: "correlation",
    impact: "medium",
    timestamp: "Yesterday"
  },
  {
    id: "insight-3",
    title: "Emerging trend in customer behavior",
    description: "Mobile purchases increasing consistently at 2.3% week-over-week for 8 weeks",
    type: "trend",
    impact: "medium",
    timestamp: "3 days ago"
  }
];

const impactColors = {
  high: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  medium: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400",
  low: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400"
};

const typeIcons = {
  anomaly: AlertCircle,
  trend: TrendingUp,
  correlation: Link
};

export const InsightsAnalytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'automatic' | 'tools'>('automatic');
  
  return (
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insights</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Discover patterns and extract meaning from your data
          </p>
        </div>
        <div className="flex space-x-3">
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button 
              className={`px-3 py-1.5 text-sm font-medium ${
                activeTab === 'automatic' 
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
              onClick={() => setActiveTab('automatic')}
            >
              Automatic
            </button>
            <button 
              className={`px-3 py-1.5 text-sm font-medium ${
                activeTab === 'tools' 
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
              onClick={() => setActiveTab('tools')}
            >
              Analysis Tools
            </button>
          </div>
          <button className="px-4 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Last 30 days
          </button>
        </div>
      </div>
      
      {activeTab === 'automatic' ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Lightbulb className="w-5 h-5 mr-2 text-blue-500" />
                Automated Insights
              </h2>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4 mr-1" />
                Last updated: 15 minutes ago
              </div>
            </div>
            
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {sampleInsights.map(insight => {
                const IconComponent = typeIcons[insight.type];
                return (
                  <div key={insight.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                    <div className="flex">
                      <div className="mr-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <IconComponent className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <h3 className="font-medium text-gray-900 dark:text-white">{insight.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${impactColors[insight.impact]}`}>
                            {insight.impact.charAt(0).toUpperCase() + insight.impact.slice(1)} Impact
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {insight.description}
                        </p>
                        <div className="flex justify-between items-center mt-3">
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {insight.timestamp}
                          </div>
                          <div className="flex space-x-2">
                            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center">
                              View Details
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-700 text-center">
              <button className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
                View All Insights
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-1 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-blue-500" />
                Trend Detection
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Automatically identifies trends and patterns in your metrics over time
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  3 trends detected this week
                </span>
                <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  Configure
                </button>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-1 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 text-blue-500" />
                Anomaly Detection
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Identifies unusual patterns and outliers in your data metrics
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  1 anomaly detected today
                </span>
                <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  Configure
                </button>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-1 flex items-center">
                <Link className="w-4 h-4 mr-2 text-blue-500" />
                Correlation Analysis
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Discovers relationships and dependencies between your metrics
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  5 correlations identified
                </span>
                <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  Configure
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">About Insights</h3>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              The Insights tab automatically analyzes your data to discover meaningful patterns. 
              Our AI-powered engine continuously monitors your metrics to detect trends, anomalies, 
              and correlations, helping you extract value from your data without manual analysis.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
              <BarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Advanced Analytics
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Perform statistical analysis on your data with correlation, regression, and variance tools
            </p>
            <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              Open Analytics
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Forecast Builder
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create predictive models and forecasts based on historical data patterns
            </p>
            <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              Build Forecast
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
              <Download className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Report Generator
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create custom reports with insights, visualizations, and commentary
            </p>
            <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              Create Report
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Anomaly Scanner
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Deep analysis of data anomalies with root cause exploration tools
            </p>
            <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              Scan for Anomalies
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center mb-4">
              <Link className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Correlation Finder
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Discover relationships between disparate metrics and data sources
            </p>
            <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              Find Correlations
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              What-If Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Test hypothetical scenarios by adjusting parameters and viewing outcomes
            </p>
            <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              Start Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 