import React, { useState, useEffect } from 'react';
import { X, DollarSign, Users, TrendingUp, Hash, Check, AlertCircle, ChevronUp, ChevronDown, ArrowUpRight, ArrowDownRight, Clock, Database, Zap, RefreshCw, Search } from 'lucide-react';
import type { MetricCard } from '../../types/dashboard';
import { metricDataService, type MetricQueryResult } from '../../services/metricDataService';
import { useDataSources } from '../../contexts/DataSourcesContext';

interface AddMetricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (metric: Omit<MetricCard, 'id'>) => void;
  editingMetric?: MetricCard;
}

const metricTypes = [
  { value: 'users', label: 'Users', icon: Users },
  { value: 'data', label: 'Data', icon: Database },
  { value: 'time', label: 'Time', icon: Clock },
  { value: 'performance', label: 'Performance', icon: Zap },
  { value: 'revenue', label: 'Revenue', icon: DollarSign },
  { value: 'numeric', label: 'Numeric', icon: Hash },
  { value: 'percentage', label: 'Percentage', icon: TrendingUp },
];

const timeframeSuggestions = [
  'Today', 
  'Last 7 days', 
  'Last 30 days', 
  'This month', 
  'This quarter', 
  'This year', 
  'vs last month', 
  'vs last year'
];

export const AddMetricModal: React.FC<AddMetricModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingMetric
}) => {
  const [formData, setFormData] = useState<Omit<MetricCard, 'id'>>({
    title: '',
    value: '',
    type: 'users',
    trend: undefined,
    period: 'vs last month',
    status: 'neutral',
    prefix: '',
    suffix: '',
    chartData: [30, 40, 50, 60, 70, 60, 70, 80] // Default chart data
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [timeframeOpen, setTimeframeOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  
  // Data source and query handling
  const [dataSourceId, setDataSourceId] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [queryResult, setQueryResult] = useState<MetricQueryResult | null>(null);
  const [showDataSourceSelector, setShowDataSourceSelector] = useState(false);
  
  // Get real data sources from context
  const { dataSources, isLoading: isLoadingDataSources } = useDataSources();
  const [filteredDataSources, setFilteredDataSources] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDataSource, setSelectedDataSource] = useState<any>(null);
  
  // Filter data sources when search term changes
  useEffect(() => {
    if (!dataSources || dataSources.length === 0) return;
    
    if (!searchTerm) {
      setFilteredDataSources(dataSources);
      return;
    }
    
    const filtered = dataSources.filter(source => 
      source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    setFilteredDataSources(filtered);
  }, [dataSources, searchTerm]);
  
  // Set default data source when sources are loaded
  useEffect(() => {
    if (dataSources?.length > 0 && !selectedDataSource) {
      setSelectedDataSource(dataSources[0]);
      setDataSourceId(dataSources[0].id ?? '');
      setFilteredDataSources(dataSources);
    }
  }, [dataSources, selectedDataSource]);
  
  // Predefined queries based on metric type
  const predefinedQueries = {
    users: {
      default: 'COUNT users WHERE status = active',
      'snowflake': 'SELECT COUNT(*) FROM users WHERE created_at > CURRENT_DATE - 30',
      '***REMOVED***': 'SELECT COUNT(*) FROM users WHERE created_at > CURRENT_DATE - 30',
      'mysql': 'SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL 30 DAY',
      'mongodb': 'db.users.count({ status: "active" })',
      'qdrant': 'COUNT users WHERE status = active',
      'api': '/api/users/count?status=active',
      'file': 'COUNT users.csv WHERE status = active'
    },
    data: {
      default: 'SUM data.size FROM storage',
      'snowflake': 'SELECT SUM(file_size) FROM files',
      '***REMOVED***': 'SELECT SUM(size) FROM files',
      'mysql': 'SELECT SUM(size) FROM files',
      'mongodb': 'db.files.aggregate([{ $group: { _id: null, total: { $sum: "$size" } } }])',
      'qdrant': 'SUM files.size',
      'api': '/api/storage/usage',
      'file': 'SUM files.csv WHERE type = documents'
    },
    time: {
      default: 'AVG response_time FROM logs',
      'snowflake': 'SELECT AVG(response_time) FROM api_logs',
      '***REMOVED***': 'SELECT AVG(response_time) FROM api_logs',
      'mysql': 'SELECT AVG(response_time) FROM api_logs',
      'mongodb': 'db.api_logs.aggregate([{ $group: { _id: null, avg: { $avg: "$response_time" } } }])',
      'qdrant': 'AVG logs.response_time',
      'api': '/api/performance/response-time',
      'file': 'AVG logs.csv WHERE endpoint = api'
    },
    performance: {
      default: 'AVG cpu_usage FROM metrics',
      'snowflake': 'SELECT AVG(cpu_percent) FROM system_metrics',
      '***REMOVED***': 'SELECT AVG(cpu_percent) FROM system_metrics',
      'mysql': 'SELECT AVG(cpu_percent) FROM system_metrics',
      'mongodb': 'db.system_metrics.aggregate([{ $group: { _id: null, avg: { $avg: "$cpu_percent" } } }])',
      'qdrant': 'AVG metrics.cpu_usage',
      'api': '/api/system/performance',
      'file': 'AVG metrics.csv WHERE metric_name = cpu_usage'
    },
    revenue: {
      default: 'SUM amount FROM transactions',
      'snowflake': 'SELECT SUM(amount) FROM orders WHERE created_at > CURRENT_DATE - 30',
      '***REMOVED***': 'SELECT SUM(amount) FROM orders WHERE created_at > CURRENT_DATE - 30',
      'mysql': 'SELECT SUM(amount) FROM orders WHERE created_at > NOW() - INTERVAL 30 DAY',
      'mongodb': 'db.orders.aggregate([{ $match: { created_at: { $gt: new Date(Date.now() - 30*24*60*60*1000) } } }, { $group: { _id: null, total: { $sum: "$amount" } } }])',
      'qdrant': 'SUM orders.amount WHERE created_at > now(-30d)',
      'api': '/api/finance/revenue',
      'file': 'SUM transactions.csv WHERE type = order'
    }
  };
  
  // Check for mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset form when opening modal
  useEffect(() => {
    if (isOpen) {
      if (editingMetric) {
        setFormData({
          title: editingMetric.title || '',
          value: editingMetric.value || '',
          type: editingMetric.type || 'users',
          trend: editingMetric.trend,
          period: editingMetric.period || 'vs last month',
          status: editingMetric.status || 'neutral',
          prefix: editingMetric.prefix || '',
          suffix: editingMetric.suffix || '',
          color: editingMetric.color,
          chartData: editingMetric.chartData || [30, 40, 50, 60, 70, 60, 70, 80]
        });
        
        // Load any saved query if present
        if (editingMetric.metricQuery) {
          setQuery(editingMetric.metricQuery);
        }
        
        // Load data source if available
        if (editingMetric.dataSourceId && dataSources) {
          const source = dataSources.find(ds => ds.id === editingMetric.dataSourceId);
          if (source) {
            setSelectedDataSource(source);
            setDataSourceId(source.id ?? '');
          }
        }
      } else {
        setFormData({
          title: '',
          value: '',
          type: 'users',
          trend: undefined,
          period: 'vs last month',
          status: 'neutral',
          prefix: '',
          suffix: '',
          chartData: [30, 40, 50, 60, 70, 60, 70, 80]
        });
        setQuery('');
      }
      setErrors({});
      setSearchTerm('');
      
      // If we have data sources loaded, set the first one as default
      if (dataSources && dataSources.length > 0 && !selectedDataSource) {
        setSelectedDataSource(dataSources[0]);
        setDataSourceId(dataSources[0].id ?? '');
      }
      
      setQueryResult(null);
    }
  }, [isOpen, editingMetric, dataSources, selectedDataSource]);
  
  // Update query when metric type or data source changes
  useEffect(() => {
    if (formData.type && selectedDataSource?.id && !query) {
      const queries = predefinedQueries[formData.type as keyof typeof predefinedQueries];
      if (queries) {
        // Try to get a query specific to this data source type
        const dataSourceType = selectedDataSource.type.toLowerCase();
        const suggestedQuery = queries[dataSourceType as keyof typeof queries] || queries.default;
        
        if (suggestedQuery) {
          setQuery(suggestedQuery);
        }
      }
    }
  }, [formData.type, selectedDataSource?.id, selectedDataSource?.type, query]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when field is updated
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleTimeframeSelect = (timeframe: string) => {
    setFormData(prev => ({
      ...prev,
      period: timeframe
    }));
    setTimeframeOpen(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!queryResult) {
      newErrors.query = 'Please run a query to get metric data';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Use the query result values instead of manual inputs
      const processedFormData = {
        ...formData,
        value: queryResult?.value || 0,
        trend: queryResult?.trend,
        chartData: queryResult?.chartData || formData.chartData,
        metricQuery: query // Store the query for future reference
      };
      
      onSave(processedFormData);
    }
  };

  // Helper to show icon based on metric type
  const getTypeIcon = (type: string) => {
    const metricType = metricTypes.find(t => t.value === type);
    if (metricType) {
      const Icon = metricType.icon;
      return <Icon className="w-4 h-4" />;
    }
    return <Hash className="w-4 h-4" />;
  };

  // Query handling
  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleDataSourceChange = (dataSource: any) => {
    setSelectedDataSource(dataSource);
    setDataSourceId(dataSource.id);
    setShowDataSourceSelector(false);
    
    // Suggest a query based on the selected data source and metric type
    if (formData.type) {
      const queries = predefinedQueries[formData.type as keyof typeof predefinedQueries];
      if (queries) {
        // Try to get a query specific to this data source type
        const dataSourceType = dataSource.type.toLowerCase();
        const suggestedQuery = queries[dataSourceType as keyof typeof queries] || queries.default;
        
        if (suggestedQuery) {
          setQuery(suggestedQuery);
        }
      }
    }
  };

  const executeQuery = async () => {
    if (!query.trim()) {
      return;
    }

    setIsLoadingData(true);
    try {
      // Include time period in the query parameters
      const result = await metricDataService.executeQuery({
        dataSourceId: dataSourceId || 'local-source',
        query: query.trim(),
        timePeriod: formData.period || 'vs last month'
      });
      
      setQueryResult(result);
      
      // Update form data with the result
      setFormData(prev => ({
        ...prev,
        value: result.value.toString(),
        trend: result.trend,
        chartData: result.chartData || prev.chartData
      }));
    } catch (error) {
      console.error('Error executing query:', error);
      setErrors(prev => ({
        ...prev,
        query: 'Error executing query'
      }));
    } finally {
      setIsLoadingData(false);
    }
  };

  const renderPreview = () => {
    // Get trend color and icon
    const getTrendDisplay = () => {
      if (!formData.trend && formData.trend !== 0) return null;
      
      const trendValue = Number(formData.trend);
      if (isNaN(trendValue)) return null;
      
      const isPositive = trendValue > 0;
      const trendColor = isPositive 
        ? 'text-green-600 dark:text-green-400' 
        : trendValue < 0 
          ? 'text-red-600 dark:text-red-400' 
          : 'text-gray-600 dark:text-gray-400';
      
      const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;
      
      return (
        <div className={`flex items-center ${trendColor}`}>
          <TrendIcon className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">{isPositive ? '+' : ''}{trendValue}%</span>
        </div>
      );
    };

    // Normalize data for mini chart
    const normalizeChartData = (data: number[]) => {
      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min;
      return data.map(value => ((value - min) / (range || 1)) * 100);
    };

    // Get chart color based on trend
    const getChartColor = () => {
      if (!formData.trend && formData.trend !== 0) return 'bg-gray-400 dark:bg-gray-500';
      
      const trendValue = Number(formData.trend);
      if (isNaN(trendValue)) return 'bg-gray-400 dark:bg-gray-500';
      
      return trendValue > 0 
        ? 'bg-green-400 dark:bg-green-500' 
        : trendValue < 0 
          ? 'bg-red-400 dark:bg-red-500' 
          : 'bg-gray-400 dark:bg-gray-500';
    };

    const normalizedData = normalizeChartData(formData.chartData || []);
    
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Preview</h4>
          <button 
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        
        {showPreview && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  {getTypeIcon(formData.type || 'users')}
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formData.title || 'Unnamed Metric'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.period || 'No timeframe'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 mb-4">
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formData.prefix}{formData.value || '0'}{formData.suffix}
              </div>
              {getTrendDisplay()}
            </div>
            
            {/* Mini chart */}
            <div className="h-12 bg-gray-50 dark:bg-gray-900/20 rounded-lg overflow-hidden">
              <div className="flex items-end h-full w-full justify-between px-1">
                {normalizedData.map((height, i) => (
                  <div 
                    key={i}
                    className={`w-[3px] rounded-t ${getChartColor()}`}
                    style={{ height: `${Math.max(5, height)}%` }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const getDataSourceTypeIcon = (source: any) => {
    // Return different icons based on data source type
    const type = source.type?.toLowerCase() || '';
    
    if (type.includes('snowflake')) {
      return <Database className="w-5 h-5" />;
    } else if (type.includes('csv') || type.includes('file')) {
      return <Database className="w-5 h-5" />;
    } else if (type.includes('mysql') || type.includes('***REMOVED***')) {
      return <Database className="w-5 h-5" />;
    }
    
    // Default icon
    return <Database className="w-5 h-5" />;
  };

  return (
    <div className={`fixed inset-0 z-[1000] overflow-y-auto ${isOpen ? '' : 'hidden'}`}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true">
      <div className="flex items-center justify-center min-h-screen p-0">
        <div className={`fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} aria-hidden="true"></div>
        
        <div 
          className={`relative z-[1001] mx-auto rounded-xl bg-white dark:bg-gray-800 
            ${isMobile ? 'w-full max-w-[95%]' : 'w-full max-w-xl'}
            shadow-xl transition-all px-5 py-5 text-left
            ${isOpen ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'}`}
        >
          <div className="absolute right-4 top-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-5">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Hash className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingMetric ? 'Edit Metric' : 'Add New Metric'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {editingMetric 
                    ? 'Update the details for this metric card' 
                    : 'Create a new metric to track key performance indicators'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Data Source Selector Popup */}
          {showDataSourceSelector && (
            <div className="absolute inset-0 z-[1002] bg-white dark:bg-gray-800 rounded-xl p-5 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Data Source</h3>
                <button
                  type="button"
                  onClick={() => setShowDataSourceSelector(false)}
                  className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                    hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Search for data sources */}
              <div className="mb-4 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                    shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500
                    dark:bg-gray-700 dark:text-white"
                  placeholder="Search data sources..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
              
              {isLoadingDataSources ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="w-5 h-5 text-purple-500 animate-spin mr-2" />
                  <span className="text-gray-600 dark:text-gray-300">Loading data sources...</span>
                </div>
              ) : filteredDataSources.length === 0 ? (
                <div className="text-center p-6 text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'No matching data sources found' : 'No data sources available'}
                </div>
              ) : (
                <div className="grid gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                  {filteredDataSources
                    .filter(source => source.type && (
                      source.type.toLowerCase().includes('csv') || 
                      source.type.toLowerCase().includes('snowflake') ||
                      source.type.toLowerCase().includes('file') ||
                      source.type.toLowerCase().includes('mysql') || 
                      source.type.toLowerCase().includes('***REMOVED***')
                    ))
                    .map(source => (
                      <button
                        key={source.id}
                        onClick={() => handleDataSourceChange(source)}
                        className={`flex items-center p-3 rounded-lg transition-colors ${
                          selectedDataSource?.id === source.id 
                            ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800' 
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          selectedDataSource?.id === source.id
                            ? 'bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          {getDataSourceTypeIcon(source)}
                        </div>
                        <div className="ml-3 flex-1 text-left">
                          <div className="font-medium text-gray-900 dark:text-white text-ellipsis overflow-hidden">{source.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{source.type}</div>
                        </div>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          )}
          
          {/* Two column layout on larger screens */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Form column */}
            <div className="flex-1">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Metric Title<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      errors.title 
                        ? 'border-red-300 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                    } dark:bg-gray-700 dark:text-white placeholder-gray-400 shadow-sm`}
                    placeholder="e.g., Active Users"
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                      <AlertCircle className="w-3.5 h-3.5 mr-1" />
                      {errors.title}
                    </p>
                  )}
                </div>
                
                {/* Metric Type */}
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Metric Type
                  </label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                      focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white shadow-sm"
                  >
                    {metricTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                
                {/* Data Source and Query */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Data Source
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDataSourceSelector(true)}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                    >
                      Change
                    </button>
                  </div>
                  <div className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 mb-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{selectedDataSource?.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{selectedDataSource?.type}</div>
                    </div>
                  </div>
                  
                  <label htmlFor="query" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data Query<span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <textarea
                      id="query"
                      name="query"
                      value={query}
                      onChange={handleQueryChange}
                      rows={3}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        errors.query 
                          ? 'border-red-300 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                      } dark:bg-gray-700 dark:text-white shadow-sm`}
                      placeholder="Enter a query or expression (e.g. count users, 128*45, etc.)"
                    />
                    {errors.query && (
                      <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        {errors.query}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={executeQuery}
                        disabled={isLoadingData || !query.trim()}
                        className={`inline-flex items-center text-sm px-3 py-1.5 rounded-lg ${
                          isLoadingData || !query.trim()
                            ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50'
                        }`}
                      >
                        {isLoadingData ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-1.5" />
                            Run Query
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {queryResult?.error && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start">
                        <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5 mr-2" />
                        <p className="text-sm text-red-700 dark:text-red-400">
                          {queryResult.error}
                        </p>
                      </div>
                    </div>
                  )}

                  {queryResult && !queryResult.error && (
                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-start">
                        <Check className="w-4 h-4 text-green-500 dark:text-green-400 mt-0.5 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-green-800 dark:text-green-300">
                            Query Success
                          </p>
                          <div className="mt-1 text-sm text-green-700 dark:text-green-400">
                            Value: <span className="font-medium">{queryResult.value}</span>
                            {queryResult.trend !== undefined && (
                              <> • Trend: <span className="font-medium">{queryResult.trend}%</span></>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Time Period */}
                <div>
                  <label htmlFor="period" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time Period
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTimeframeOpen(!timeframeOpen)}
                      className="w-full px-3 py-2 flex items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 
                        hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <span className="text-gray-900 dark:text-white">
                        {formData.period || "Select timeframe"}
                      </span>
                      {timeframeOpen ? (
                        <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                    
                    {timeframeOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                        rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {timeframeSuggestions.map((timeframe) => (
                          <button
                            key={timeframe}
                            type="button"
                            onClick={() => handleTimeframeSelect(timeframe)}
                            className="w-full px-3 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {timeframe}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>
            
            {/* Preview column */}
            <div className="md:w-5/12">
              {renderPreview()}
            </div>
          </div>
            
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center items-center rounded-lg
                px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600
                text-gray-700 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300
                dark:ring-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg px-4 py-2.5
                bg-purple-600 hover:bg-purple-700 text-white shadow-sm focus:outline-none
                focus:ring-2 focus:ring-purple-500 text-sm font-medium"
            >
              <Check className="w-4 h-4 mr-1.5" />
              {editingMetric ? 'Update Metric' : 'Add Metric'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 