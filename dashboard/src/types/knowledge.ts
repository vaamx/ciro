export type DataSourceType = 
  | 'database'
  | 'crm'
  | 'storage'
  | 'local-files'
  | 'api'
  | 'file-system';
export type ContentType = 'document' | 'article' | 'code' | 'issue' | 'task';

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  icon: string;
  baseUrl?: string;
  apiKey?: string;
  isActive: boolean;
  lastSynced?: Date;
  originalSource?: any;
  dataSourceType?: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  description?: string;
  path: string;
  sourceId: string;
  type: ContentType;
  content: string;
  dataSourceType?: string;
  metadata: {
    lastModified: Date;
    author: string;
    tags: string[];
    version?: string;
  };
  stats: {
    accessCount: number;
    lastAccessed?: Date;
    rating?: number;
  };
}

export interface UserKnowledgePreferences {
  pinnedSources: string[];
  pinnedItems: string[];
  defaultView: 'tree' | 'list' | 'grid';
  favoriteTopics: string[];
}

export interface SearchFilters {
  query: string;
  sources?: string[];
  types?: ContentType[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  author?: string;
} 