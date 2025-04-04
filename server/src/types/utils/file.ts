export interface File {
  id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  file_type: string;
  metadata: Record<string, any>;
  hasContent: boolean;
  organization_id: number;
  uploaded_by: string;
  created_at: Date;
  updated_at: Date;
} 