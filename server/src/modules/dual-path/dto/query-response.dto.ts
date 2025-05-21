export enum QueryProcessingPath {
  DIRECT_RETRIEVAL = 'direct_retrieval',
  ANALYTICAL_TASK = 'analytical_task',
  CLARIFICATION_NEEDED = 'clarification_needed',
  RAG = 'rag',
  CODE_EXECUTION = 'code_execution',
  HYBRID = 'hybrid',
}

export class RoutingResponseDto {
  path!: QueryProcessingPath;
  confidence!: number;
  processingTime?: number;
}

export class QueryResultDto {
  content?: string;
  sources?: any[];
  [key: string]: any;
}

export class RagResultDto {
  content?: string;
  sources?: any[];
  [key: string]: any;
}

export class CodeExecutionResultDto {
  content?: string;
  data?: any;
  [key: string]: any;
}

export class HybridResultDto {
  ragResult?: RagResultDto;
  codeExecutionResult?: CodeExecutionResultDto;
}

export class QueryResponseDto {
  routing!: RoutingResponseDto;
  result!: QueryResultDto | RagResultDto | CodeExecutionResultDto | HybridResultDto;
} 