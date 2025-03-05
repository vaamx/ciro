export interface OpenAIConfig {
  apiKey: string | undefined;
  orgId?: string | undefined;
  baseURL?: string | undefined;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
}

export interface CorsConfig {
  origin: string;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
}

export interface QdrantConfig {
  url: string;
  apiKey?: string;
}

export interface TasksConfig {
  summarizationInterval?: number; // in milliseconds
  cleanupInterval?: number; // in milliseconds
  indexingInterval?: number; // in milliseconds
}

export interface Config {
  port: number | string;
  uploadsDir: string;
  database: DatabaseConfig;
  openai: OpenAIConfig;
  jwt: JWTConfig;
  cors: CorsConfig;
  qdrant: QdrantConfig;
  tasks?: TasksConfig;
} 