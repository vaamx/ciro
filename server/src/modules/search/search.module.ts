import { Module, Logger, forwardRef } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { AuthModule } from '../../core/auth/auth.module';
import { ServicesModule } from '../../services.module';
import { DocumentProcessingModule } from '../document-processing/document-processing.module';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from '@services/ai/openai.service';
import { QdrantSearchService } from '@services/vector/search.service';
import { DocumentProcessingService } from '../document-processing/document-processing.service';

@Module({
  imports: [
    AuthModule, // For authentication guard
    forwardRef(() => ServicesModule), // Import the main services module that provides required services with forwardRef to avoid circular dependencies
    DocumentProcessingModule, // Import to provide DocumentProcessingService
  ],
  controllers: [SearchController],
  providers: [
    Logger,
    // Provide Pool using a factory
    {
      provide: Pool,
      useFactory: (configService: ConfigService) => {
        const dbConfig = {
          host: configService.get('DB_HOST'),
          port: configService.get('DB_PORT'),
          user: configService.get('DB_USER'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_NAME'),
        };
        return new Pool(dbConfig);
      },
      inject: [ConfigService],
    },
    // Provide SearchService with proper dependency injection
    {
      provide: SearchService,
      useFactory: (
        documentProcessorService: DocumentProcessingService,
        openAIService?: OpenAIService,
        qdrantSearchService?: QdrantSearchService,
        pool?: Pool
      ) => {
        return new SearchService(
          documentProcessorService,
          openAIService as any,
          qdrantSearchService as any,
          pool as any
        );
      },
      inject: [
        DocumentProcessingService,
        { token: OpenAIService, optional: true },
        { token: QdrantSearchService, optional: true },
        Pool
      ]
    }
  ],
  exports: [SearchService],
})
export class SearchModule {} 