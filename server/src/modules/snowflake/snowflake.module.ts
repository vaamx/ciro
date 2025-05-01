import { Module, Logger } from '@nestjs/common';
import { SnowflakeController } from './snowflake.controller';
import { SnowflakeService } from './snowflake.service';
import { SnowflakeNLQueryService } from '../../services/features/nl-query/snowflake/snowflake-nl-query.service';
import { AuthModule } from '../../core/auth/auth.module';

@Module({
  imports: [
    AuthModule, // For authentication guards
  ],
  controllers: [SnowflakeController],
  providers: [
    SnowflakeService,
    // Create a provider for Logger
    {
      provide: Logger,
      useValue: new Logger('Snowflake')
    },
    // Provide the existing SnowflakeNLQueryService
    {
      provide: SnowflakeNLQueryService,
      useFactory: () => {
        try {
          // Import dynamically to avoid circular dependency issues
          const { SnowflakeNLQueryService } = require('../../services/features/nl-query/snowflake/snowflake-nl-query.service');
          return SnowflakeNLQueryService.getInstance();
        } catch (error) {
          console.error('Failed to load SnowflakeNLQueryService:', error);
          return null;
        }
      }
    }
  ],
  exports: [SnowflakeService]
})
export class SnowflakeModule {} 