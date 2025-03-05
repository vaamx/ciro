-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Print confirmation message
\echo 'PostgreSQL extensions initialized: uuid-ossp, pgcrypto, and vector' 