import { Module } from '@nestjs/common';
import { ChunkController } from './chunk.controller';
import { ChunkService } from './chunk.service';
// import { DocumentProcessingModule } from '../document-processing/document-processing.module'; // Import if DocumentPipelineService comes from here
// Correct the import path based on the actual module providing DocumentPipelineService
import { ProcessorsModule } from '@services/datasources/processors/file/processors.module';

@Module({
  imports: [
    // If DocumentPipelineService is provided by DocumentProcessingModule:
    // DocumentProcessingModule,
    // Corrected import:
    ProcessorsModule,
    // Add other necessary modules like AuthModule if GetUser decorator relies on it
  ],
  controllers: [ChunkController],
  providers: [ChunkService],
})

export class ChunkModule {} 