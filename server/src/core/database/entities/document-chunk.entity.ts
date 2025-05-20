import { DataSource } from './data-source.entity';

export class DocumentChunk {
  id!: string;

  data_source_id!: number;

  dataSource!: DataSource;

  content!: string;

  embedding?: any;

  metadata?: Record<string, any>;

  created_at!: Date;

  updated_at!: Date;
} 