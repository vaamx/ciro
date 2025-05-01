export interface SearchResultDto {
  id?: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  fileId?: string;
}

export class SearchResponseDto {
  results: SearchResultDto[] = [];
  total = 0;
  query = '';
} 