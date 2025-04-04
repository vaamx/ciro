## Visualization Generation API

The application now includes an API for generating visualizations from Qdrant and Snowflake data sources. This API analyzes the data to determine the most appropriate visualization type and generates the corresponding configuration.

### Endpoints

- `POST /api/visualizations/generate/:dataSourceId` - Generate a visualization for a data source

### Implementation Details

1. **Backend:**
   - `VisualizationController` - Handles requests to generate visualizations
   - Uses the existing `VisualizationService` to create visualization configurations
   - Analyzes data using OpenAI to determine the best visualization type

2. **Frontend:**
   - The `DataSourcesContext` provides a `generateVisualization` method that calls the API
   - The `QdrantVisualizationGenerator` component uses this method to create visualizations in the Studio

### Testing

To test the visualization generation:

1. Start the server
2. Log in to the dashboard
3. Go to the Studio
4. Click "Generate from Data" button
5. Select a Qdrant collection or Snowflake table
6. Click "Generate Visualization"

The system will analyze the data and create an appropriate visualization that will be added to your workspace. 