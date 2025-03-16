import React, { useState, useEffect } from 'react';
import { 
  X,
  BarChart2,
  LineChart,
  PieChart,
  ChevronRight,
  Check,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { Widget } from './WidgetManager';

interface DataSource {
  id: string;
  name: string;
  type: string;
}

interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widget: Omit<Widget, 'id'>) => void;
  availableDataSources: DataSource[];
}

const widgetTemplates: WidgetTemplate[] = [
  {
    id: 'bar-chart',
    name: 'Bar Chart',
    description: 'Compare values across categories with vertical bars',
    icon: <BarChart2 className="w-5 h-5" />
  },
  {
    id: 'line-chart',
    name: 'Line Chart',
    description: 'Track trends over time with connected data points',
    icon: <LineChart className="w-5 h-5" />
  },
  {
    id: 'pie-chart',
    name: 'Pie Chart',
    description: 'Show proportions of a whole with circular segments',
    icon: <PieChart className="w-5 h-5" />
  },
  {
    id: 'map',
    name: 'Map',
    description: 'Visualize data geographically on an interactive map',
    icon: <MapPin className="w-5 h-5" />
  }
];

const sampleDataSources = [
  { id: 'sales', name: 'Sales Data', type: 'table' },
  { id: 'users', name: 'User Metrics', type: 'api' },
  { id: 'performance', name: 'System Performance', type: 'timeseries' }
];

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({
  isOpen,
  onClose,
  onAddWidget,
  availableDataSources = sampleDataSources
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedDataSource, setSelectedDataSource] = useState<string | null>(null);
  const [widgetTitle, setWidgetTitle] = useState('');
  const [widgetSize, setWidgetSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [widgetConfig, setWidgetConfig] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Check for mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSelectedTemplate(null);
      setSelectedDataSource(null);
      setWidgetTitle('');
      setWidgetSize('medium');
      setWidgetConfig({});
      setErrors({});
    }
  }, [isOpen]);

  const validateStep = (step: number): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (step === 1 && !selectedTemplate) {
      newErrors.template = 'Please select a widget template';
    }
    
    if (step === 2 && !selectedDataSource) {
      newErrors.dataSource = 'Please select a data source';
    }
    
    if (step === 3) {
      if (!widgetTitle.trim()) {
        newErrors.title = 'Widget title is required';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = () => {
    if (validateStep(3) && selectedTemplate && selectedDataSource) {
      const newWidget: Omit<Widget, 'id'> = {
        title: widgetTitle,
        type: selectedTemplate,
        widget_type: selectedTemplate,
        size: widgetSize,
        content: <div className="p-4 animate-pulse">Loading {selectedTemplate} data...</div>,
        position: 0,
        settings: {
          refreshInterval: widgetConfig.refreshInterval || 0,
          showTitle: true,
          expandable: true,
          dataSource: selectedDataSource,
          ...widgetConfig
        }
      };
      
      onAddWidget(newWidget);
      onClose();
    }
  };

  const getStepTitle = (step: number): string => {
    switch (step) {
      case 1:
        return 'Select Widget Type';
      case 2:
        return 'Choose Data Source';
      case 3:
        return 'Configure Widget';
      default:
        return '';
    }
  };

  const renderStepIndicator = () => {
    return (
      <div className="flex items-center justify-center mb-6">
        {[1, 2, 3].map((step) => (
          <React.Fragment key={step}>
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === step
                  ? 'bg-purple-600 text-white'
                  : currentStep > step
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {step}
            </div>
            {step < 3 && (
              <div 
                className={`w-12 sm:w-16 h-0.5 ${
                  currentStep > step
                    ? 'bg-purple-400 dark:bg-purple-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderStep1 = () => {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select the type of widget you want to add to your dashboard:
        </p>
        
        {errors.template && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {errors.template}
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {widgetTemplates.map((template) => (
            <div
              key={template.id}
              className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                selectedTemplate === template.id
                  ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
              onClick={() => {
                setSelectedTemplate(template.id);
                if (errors.template) {
                  setErrors(prev => ({ ...prev, template: '' }));
                }
              }}
            >
              <div className="flex items-start">
                <div className={`p-2 rounded-lg mr-3 ${
                  selectedTemplate === template.id
                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {template.icon}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {template.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose a data source for your widget:
        </p>
        
        {errors.dataSource && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {errors.dataSource}
            </p>
          </div>
        )}
        
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {availableDataSources.map((source) => (
            <div
              key={source.id}
              className={`p-4 border rounded-xl cursor-pointer transition-all ${
                selectedDataSource === source.id
                  ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
              onClick={() => {
                setSelectedDataSource(source.id);
                if (errors.dataSource) {
                  setErrors(prev => ({ ...prev, dataSource: '' }));
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {source.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Type: {source.type}
                  </p>
                </div>
                {selectedDataSource === source.id && (
                  <div className="w-6 h-6 bg-purple-600 dark:bg-purple-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Configure your widget settings:
        </p>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="widget-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Widget Title*
            </label>
            <input
              id="widget-title"
              type="text"
              value={widgetTitle}
              onChange={(e) => {
                setWidgetTitle(e.target.value);
                if (errors.title) {
                  setErrors(prev => ({ ...prev, title: '' }));
                }
              }}
              className={`w-full px-3 py-2.5 rounded-lg border ${
                errors.title 
                  ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500'
              } dark:bg-gray-700 dark:text-white placeholder-gray-400 shadow-sm`}
              placeholder="Enter widget title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                {errors.title}
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Widget Size
            </label>
            <div className="flex flex-wrap gap-3">
              {['small', 'medium', 'large'].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setWidgetSize(size as 'small' | 'medium' | 'large')}
                  className={`px-4 py-2.5 rounded-lg border ${
                    widgetSize === size
                      ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  } transition-colors text-sm font-medium capitalize flex-grow sm:flex-grow-0`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Widget Preview
            </h3>
            <div className={`border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm ${
              widgetSize === 'small' ? 'h-48' : widgetSize === 'medium' ? 'h-64' : 'h-80'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {widgetTitle || 'Widget Title'}
                </h3>
              </div>
              <div className="flex items-center justify-center h-[calc(100%-2.5rem)] bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                {selectedTemplate === 'bar-chart' && <BarChart2 className="w-8 h-8 text-gray-400 dark:text-gray-500" />}
                {selectedTemplate === 'line-chart' && <LineChart className="w-8 h-8 text-gray-400 dark:text-gray-500" />}
                {selectedTemplate === 'pie-chart' && <PieChart className="w-8 h-8 text-gray-400 dark:text-gray-500" />}
                {selectedTemplate === 'map' && <MapPin className="w-8 h-8 text-gray-400 dark:text-gray-500" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // This function is kept for future configuration options
  // but not currently used in the component
  // @ts-ignore
  const handleConfigChange = (key: string, value: any) => {
    setWidgetConfig({
      ...widgetConfig,
      [key]: value
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className={`relative transform overflow-hidden rounded-xl bg-white dark:bg-gray-800 
          ${isMobile ? 'w-full max-w-[95%]' : 'w-full max-w-xl'}
          shadow-xl transition-all px-4 pt-5 pb-4 sm:p-6 text-left`}
        >
          <div className="absolute right-3 top-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white
                hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {getStepTitle(currentStep)}
            </h3>
          </div>
          
          {renderStepIndicator()}
          
          <div className="mt-4">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </div>
          
          <div className="mt-6 sm:flex sm:justify-between items-center">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg
                  px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600
                  text-gray-700 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300
                  dark:ring-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium"
              >
                Back
              </button>
            ) : (
              <div className="hidden sm:block"></div>
            )}
            
            <div className={`flex mt-3 sm:mt-0 ${currentStep > 1 ? 'justify-end' : 'justify-center sm:justify-end'}`}>
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg px-4 py-2.5
                    bg-purple-600 hover:bg-purple-700 text-white shadow-sm focus:outline-none
                    focus:ring-2 focus:ring-purple-500 sm:ml-3 text-sm font-medium"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg px-4 py-2.5
                    bg-purple-600 hover:bg-purple-700 text-white shadow-sm focus:outline-none
                    focus:ring-2 focus:ring-purple-500 sm:ml-3 text-sm font-medium"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Add Widget
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 