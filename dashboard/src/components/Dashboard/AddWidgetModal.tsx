import React, { useState } from 'react';
import { 
  X,
  LayoutGrid,
  BarChart2,
  LineChart,
  PieChart,
  Activity,
  List,
  Table
} from 'lucide-react';
import { Widget } from './WidgetManager';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widget: Omit<Widget, 'id'>) => void;
}

const widgetTemplates = [
  {
    type: 'stats',
    title: 'Statistics Overview',
    description: 'Display key metrics and trends',
    icon: BarChart2,
    sizes: ['small', 'medium']
  },
  {
    type: 'lineChart',
    title: 'Line Chart',
    description: 'Visualize trends over time',
    icon: LineChart,
    sizes: ['medium', 'large']
  },
  {
    type: 'pieChart',
    title: 'Pie Chart',
    description: 'Show data distribution',
    icon: PieChart,
    sizes: ['small', 'medium']
  },
  {
    type: 'activity',
    title: 'Activity Feed',
    description: 'Real-time activity updates',
    icon: Activity,
    sizes: ['medium', 'large']
  },
  {
    type: 'table',
    title: 'Data Table',
    description: 'Display structured data',
    icon: Table,
    sizes: ['medium', 'large']
  },
  {
    type: 'list',
    title: 'List View',
    description: 'Show items in a list format',
    icon: List,
    sizes: ['small', 'medium', 'large']
  }
];

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({
  isOpen,
  onClose,
  onAddWidget
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [widgetTitle, setWidgetTitle] = useState('');
  const [widgetSize, setWidgetSize] = useState<'small' | 'medium' | 'large'>('medium');

  const handleAddWidget = () => {
    if (!selectedTemplate || !widgetTitle) return;

    const template = widgetTemplates.find(t => t.type === selectedTemplate);
    if (!template) return;

    onAddWidget({
      title: widgetTitle,
      type: selectedTemplate,
      widget_type: selectedTemplate,
      size: widgetSize,
      content: <div>Widget Content Placeholder</div>,
      position: 0,
      settings: {
        refreshInterval: 0,
        showTitle: true,
        expandable: true
      }
    });

    // Reset form
    setSelectedTemplate(null);
    setWidgetTitle('');
    setWidgetSize('medium');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Add New Widget</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto">
          {!selectedTemplate ? (
            /* Template Selection */
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {widgetTemplates.map((template) => (
                <button
                  key={template.type}
                  onClick={() => setSelectedTemplate(template.type)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left group"
                >
                  <template.icon className="w-8 h-8 text-gray-400 group-hover:text-purple-500 mb-3" />
                  <h3 className="font-medium text-gray-900 mb-1">{template.title}</h3>
                  <p className="text-sm text-gray-500">{template.description}</p>
                </button>
              ))}
            </div>
          ) : (
            /* Widget Configuration */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget Title
                </label>
                <input
                  type="text"
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter widget title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget Size
                </label>
                <div className="flex space-x-4">
                  {widgetTemplates
                    .find(t => t.type === selectedTemplate)
                    ?.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setWidgetSize(size as 'small' | 'medium' | 'large')}
                        className={`px-4 py-2 rounded-lg text-sm ${
                          widgetSize === size
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={handleAddWidget}
                  disabled={!widgetTitle}
                  className={`btn-primary flex-1 ${
                    !widgetTitle ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Add Widget
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 