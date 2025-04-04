import React, { useState } from 'react';
import { useDataSources } from '../../contexts/DataSourcesContext';
import { Database, BarChart2, Loader, AlertCircle } from 'lucide-react';
import { DataSourceType } from '../../types/shared-types';

interface QdrantVisualizationGeneratorProps {
  onVisualizationGenerated: (visualizationConfig: any) => void;
  onClose: () => void;
}

export const QdrantVisualizationGenerator: React.FC<QdrantVisualizationGeneratorProps> = ({
  onVisualizationGenerated,
  onClose
}) => {
  const { dataSources, isLoading, generateVisualization } = useDataSources();
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter to only show Qdrant and Snowflake sources
  const qdrantSources = dataSources.filter(
    (source: { type: DataSourceType; id?: string; name: string }) => 
      source.type === 'qdrant' as DataSourceType || source.type === 'snowflake' as DataSourceType
  );
  
  const handleGenerateVisualization = async () => {
    if (!selectedSourceId) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      // Use the generateVisualization method from the context
      const visualization = await generateVisualization(selectedSourceId);
      onVisualizationGenerated(visualization);
      onClose();
    } catch (error) {
      console.error('Failed to generate visualization:', error);
      setError('Could not generate visualization. Please try again.');
    } finally {
      setGenerating(false);
    }
  };
  
  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-lg max-w-xl mx-auto">
      <h2 className="text-xl font-semibold text-white mb-4">Generate Visualization from Data</h2>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="ml-3 text-gray-300">Loading data sources...</span>
        </div>
      ) : qdrantSources.length === 0 ? (
        <div className="text-center p-6 bg-gray-900 rounded-md">
          <Database className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-300">No Qdrant or Snowflake data sources available</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-600 text-sm rounded hover:bg-blue-700 transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">Select Data Source</label>
            <div className="space-y-2 max-h-72 overflow-y-auto p-1">
              {qdrantSources.map((source: { id?: string; name: string; type: DataSourceType }) => (
                <div 
                  key={source.id}
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedSourceId === source.id 
                      ? 'border-blue-500 bg-blue-900/30' 
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                  onClick={() => setSelectedSourceId(source.id || null)}
                >
                  <div className="flex items-center">
                    <Database className="w-5 h-5 text-gray-400 mr-3" />
                    <div>
                      <div className="font-medium text-white">{source.name}</div>
                      <div className="text-xs text-gray-400">
                        {source.type === 'qdrant' as DataSourceType ? 'Qdrant Collection' : 'Snowflake Table'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-md text-red-300 flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center ${
                !selectedSourceId || generating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={handleGenerateVisualization}
              disabled={!selectedSourceId || generating}
            >
              {generating ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BarChart2 className="w-4 h-4 mr-2" />
                  Generate Visualization
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}; 