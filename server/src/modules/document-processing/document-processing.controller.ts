import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { User } from '../../core/database/prisma-types';
import { DocumentProcessingService } from './document-processing.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobResponseDto, DataSourceJobsResponseDto, ProcessingMetricsResponseDto } from './dto/job-response.dto';
import { AuthGuard } from '../../core/auth/auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { Role } from '../../core/auth/role.enum';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DataSource } from '../../core/database/prisma-types';
import { Request } from 'express';
import { Multer } from 'multer';

@Controller('api/document-processing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
export class DocumentProcessingController {
  private readonly logger = new Logger(DocumentProcessingController.name);

  constructor(
    private readonly documentProcessingService: DocumentProcessingService,
  ) {}

  @Post('jobs')
  @UseInterceptors(FileInterceptor('file'))
  async createJob(
    @UploadedFile() file: Express.Multer.File,
    @Body() createJobDto: CreateJobDto,
    @GetUser() user: User
  ) {
    try {
      this.logger.log(`Creating document processing job for user ${user.id}`, {
        dataSourceId: createJobDto.dataSourceId,
        fileName: file?.originalname,
      });
      
      const result = await this.documentProcessingService.createJob(
        file,
        createJobDto.dataSourceId,
        createJobDto.metadata,
        user.id.toString(),
        createJobDto.content,
        createJobDto.fileType
      );
      
      this.logger.log(`Document processing job created: ${result.jobId}`);
      
      return result;
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(`Error creating document processing job: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create document processing job');
    }
  }

  @Get('jobs/:jobId')
  async getJobStatus(
    @Param('jobId') jobId: string,
    @GetUser() user: User
  ): Promise<JobResponseDto> {
    try {
      this.logger.log(`Getting job status for job ${jobId}`);
      
      const result = await this.documentProcessingService.getJobStatus(jobId);
      
      this.logger.log(`Retrieved job status for job ${jobId}: ${result.currentState}`);
      
      return result;
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(`Error getting job status for job ${jobId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get job status');
    }
  }

  @Get('data-sources/:dataSourceId/jobs')
  async getDataSourceJobs(
    @Param('dataSourceId') dataSourceId: string,
    @GetUser() user: User
  ): Promise<DataSourceJobsResponseDto> {
    try {
      this.logger.log(`Getting jobs for data source ${dataSourceId}`);
      
      const result = await this.documentProcessingService.getDataSourceJobs(dataSourceId);
      
      this.logger.log(
        `Retrieved jobs for data source ${dataSourceId}: ` +
        `${result.activeJobs.length} active, ${result.completedJobs.length} completed`
      );
      
      return result;
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(`Error getting jobs for data source ${dataSourceId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get data source jobs');
    }
  }

  @Delete('jobs/:jobId')
  async cancelJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User
  ) {
    try {
      this.logger.log(`Cancelling job ${jobId}`);
      
      const result = await this.documentProcessingService.cancelJob(jobId);
      
      this.logger.log(`Job ${jobId} cancelled successfully`);
      
      return result;
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(`Error cancelling job ${jobId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to cancel job');
    }
  }

  @Get('metrics')
  @Roles(Role.ADMIN)
  async getProcessingMetrics(
    @GetUser() user: User
  ): Promise<ProcessingMetricsResponseDto> {
    try {
      this.logger.log('Getting document processing metrics');
      
      const result = await this.documentProcessingService.getProcessingMetrics();
      
      this.logger.log('Retrieved document processing metrics');
      
      return result;
    } catch (error: any) {
      this.logger.error(`Error getting processing metrics: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get processing metrics');
    }
  }
} 