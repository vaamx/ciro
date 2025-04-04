import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface OpenAIConfig {
  apiKey: string | undefined;
  orgId: string | undefined;
}

interface JWTConfig {
  secret: string;
  expiresIn: string;
}

interface CorsConfig {
  origin: string | string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

interface Config {
  port: string | number;
  database: DatabaseConfig;
  openai: OpenAIConfig;
  jwt: JWTConfig;
  cors: CorsConfig;
  uploadsDir: string;
}

export const config: Config = {
  port: process.env.PORT || 3001,
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || '***REMOVED***',
    password: process.env.DB_PASSWORD || '***REMOVED***',
    database: process.env.DB_NAME || 'ciro_db'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    orgId: process.env.OPENAI_ORG_ID
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Credentials'
    ],
    exposedHeaders: ['set-cookie'],
    maxAge: 600
  },
  uploadsDir: process.env.UPLOADS_DIR || 'uploads'
}; 