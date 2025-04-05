/**
 * data-processing/snowflake services
 */

export * from './snowflake-schema-indexer.service';
export * from './snowflake-nl-query.service';
export * from './snowflake.service';
export * from './fixed-snowflake-nl-query.service';
export * from './snowflake-form.service';

/**
 * Snowflake module exports
 */

// Base service
export * from './snowflake.service';

// Form service
export * from './snowflake-form.service';

// Export the NL query services under different names to avoid conflicts
import { SnowflakeNLQueryService as StandardNLQueryService } from './snowflake-nl-query.service';
import { SnowflakeNLQueryService as EnhancedNLQueryService } from './fixed-snowflake-nl-query.service';

// Re-export with different names
export { 
  StandardNLQueryService as SnowflakeNLQueryService,
  EnhancedNLQueryService as FixedSnowflakeNLQueryService 
};
