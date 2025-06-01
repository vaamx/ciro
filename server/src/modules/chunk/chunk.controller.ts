import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Headers,
  Body,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  ParseFilePipe,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { users } from '../../core/database/prisma-types';
import { ChunkService } from './chunk.service';
import { getContentType } from '../../common/utils/file-utils';
import { UploadChunkHeaders, UploadChunkResponse } from './dto/upload-chunk.dto';
import { CompleteChunkDto, CompleteChunkResponse } from './dto/complete-chunk.dto';

@ApiTags('Chunks')
@ApiBearerAuth()
@Controller('api/chunks')
@UseGuards(JwtAuthGuard)
export class ChunkController {
  private readonly logger = new Logger(ChunkController.name);

  constructor(private readonly chunkService: ChunkService) {}

  @Post('upload')
  @HttpCode(HttpStatus.OK) // Explicitly set OK status for successful chunk upload
  @UseInterceptors(FileInterceptor('chunk')) // Assuming the file field name is 'chunk'
  @ApiOperation({ summary: 'Upload a single file chunk' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File chunk data',
    schema: {
      type: 'object',
      properties: {
        chunk: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  // Manually document headers using @ApiHeader
  @ApiHeader({ name: 'x-file-id', required: true, description: 'Unique file identifier', schema: { type: 'string' } })
  @ApiHeader({ name: 'x-chunk-index', required: true, description: '0-based chunk index', schema: { type: 'integer' } })
  @ApiHeader({ name: 'x-total-chunks', required: true, description: 'Total number of chunks', schema: { type: 'integer' } })
  @ApiHeader({ name: 'x-file-name', required: false, description: 'Original filename', schema: { type: 'string' } })
  @ApiHeader({ name: 'x-content-type', required: false, description: 'Explicit content type', schema: { type: 'string' } })
  @ApiOkResponse({ description: 'Chunk received successfully', type: UploadChunkResponse })
  @ApiBadRequestResponse({ description: 'Missing or invalid chunk information or data' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during chunk upload' })
  async uploadChunk(
    @UploadedFile() file: Express.Multer.File,
    @Headers() headers: Record<string, string>, // Get all headers
  ): Promise<UploadChunkResponse> {
    // Manual header extraction and parsing
    const fileId = headers['x-file-id'];
    const chunkIndexStr = headers['x-chunk-index'];
    const totalChunksStr = headers['x-total-chunks'];
    const rawFileName = headers['x-file-name'];
    const contentTypeHeader = headers['x-content-type'];

    if (!file) {
      throw new BadRequestException('Chunk file data is required');
    }
    if (!fileId || !chunkIndexStr || !totalChunksStr) {
      throw new BadRequestException('Missing required chunk headers (x-file-id, x-chunk-index, x-total-chunks)');
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    const totalChunks = parseInt(totalChunksStr, 10);

    if (isNaN(chunkIndex) || isNaN(totalChunks) || chunkIndex < 0 || totalChunks < 1) {
        throw new BadRequestException('Invalid chunk index or total chunks header value');
    }

    const fileName = rawFileName || file.originalname || '';
    const mimeType = contentTypeHeader || file.mimetype || getContentType(fileName) || 'application/octet-stream';

    this.logger.log(
      `Receiving chunk ${chunkIndex + 1}/${totalChunks} for file ${fileId}`, {
      size: file.size,
      mimeType,
      fileName,
    });

    try {
      await this.chunkService.storeChunk(
        fileId,
        chunkIndex,
        totalChunks,
        mimeType,
        fileName,
        file.buffer,
      );

      const progress = ((chunkIndex + 1) / totalChunks) * 100;

      return {
        success: true,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} received`,
        progress: Math.round(progress),
      };
    } catch (error) {
      this.logger.error(`Error storing chunk ${chunkIndex + 1}/${totalChunks} for file ${fileId}: ${error}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to store chunk');
    }
  }

  @Post('complete')
  @ApiOperation({ summary: 'Signal completion of chunked upload and trigger processing' })
  @ApiOkResponse({ description: 'File assembly and processing initiated', type: CompleteChunkResponse })
  @ApiBadRequestResponse({ description: 'Missing chunks or invalid request data' })
  @ApiInternalServerErrorResponse({ description: 'Failed to process completed upload' })
  async completeChunkedUpload(
    @Body() completeDto: CompleteChunkDto,
    @GetUser() user: users,
  ): Promise<CompleteChunkResponse> {
    this.logger.log(`Received completion request for file ${completeDto.fileId}`, {
      dataSourceId: completeDto.dataSourceId,
      userId: user.id,
    });

    try {
      const result = await this.chunkService.processCompleteUpload(
        completeDto.fileId,
        completeDto.dataSourceId,
        user.id.toString(),
        completeDto.metadata || {},
      );

      this.logger.log(`Processing job ${result.jobId} queued for file ${completeDto.fileId}`);

      return {
        success: true,
        jobId: result.jobId,
        message: 'File assembled and processing job queued.',
      };
    } catch (error) {
      this.logger.error(`Error completing upload for file ${completeDto.fileId}: ${error}`, error instanceof Error ? error.stack : undefined);
      if (error instanceof BadRequestException) {
        throw error; // Re-throw client errors directly
      }
      throw new InternalServerErrorException('Failed to complete chunked upload processing');
    }
  }
} 