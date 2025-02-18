import { type DataSource } from '../types';

export const dataSources: { [key: string]: DataSource[] } = {
  internal: [
    { id: 'all-data', name: 'All Data Sources', icon: '🎯', type: 'internal', description: 'Query across all data sources' },
    { id: '***REMOVED***', name: 'PostgreSQL', icon: '🐘', type: 'internal', description: 'Production and analytics databases' },
    { id: 'supabase', name: 'Supabase', icon: '⚡', type: 'internal', description: 'Real-time and edge databases' },
    { id: 'bigquery', name: 'BigQuery', icon: '📊', type: 'internal', description: 'Data warehouse and analytics' },
    { id: 'snowflake', name: 'Snowflake', icon: '❄️', type: 'internal', description: 'Enterprise data warehouse' },
    { id: 'hubspot', name: 'HubSpot', icon: '🎯', type: 'internal', description: 'CRM and marketing data' },
    { id: 'gdrive', name: 'Google Drive', icon: '📁', type: 'internal', description: 'Documents and spreadsheets' },
    { id: 'notion', name: 'Notion', icon: '📝', type: 'internal', description: 'Team documentation and notes' },
    { id: 'metabase', name: 'Metabase', icon: '📈', type: 'internal', description: 'BI dashboards and reports' },
    { id: 'looker', name: 'Looker', icon: '👀', type: 'internal', description: 'Business intelligence platform' }
  ],
  customer: [
    { id: 'help-center', name: 'Help Center', icon: '💡', type: 'customer', description: 'Customer documentation and guides' },
    { id: 'api-docs', name: 'API Reference', icon: '🔌', type: 'customer', description: 'API documentation and examples' },
    { id: 'tutorials', name: 'Tutorials', icon: '📚', type: 'customer', description: 'Step-by-step guides and tutorials' },
    { id: 'faqs', name: 'FAQs', icon: '❓', type: 'customer', description: 'Frequently asked questions' },
    { id: 'community', name: 'Community', icon: '👥', type: 'customer', description: 'Community discussions and solutions' }
  ]
}; 