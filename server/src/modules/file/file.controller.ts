import {
    Controller,
    Get,
    Post,
    Delete,
    Put,
    Param,
    Query,
    Req,
    Res,
    Body,
    UploadedFile,
    UseInterceptors,
    UseGuards,
    ParseIntPipe,
    StreamableFile,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService, DbFileRecord } from './file.service';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { User } from '../../core/database/prisma-types';
import { ApiTags, ApiConsumes, ApiBody, ApiQuery, ApiParam, ApiOperation } from '@nestjs/swagger';
import { FileStatusDto, UserFilesRequestDto, UserFilesResponseDto, UploadFileDto } from './dto';
import 'multer'; // Import Multer type augmentation

// Define a temporary placeholder type for the request user
interface AuthenticatedRequest {
  user: { id: string; organizationId: string | number; /* other user props */ };
}
// Define a placeholder for Express.Multer.File if types aren't fully resolved
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
    // Add other potential properties like destination, filename, path if needed
    filename?: string;
    path?: string;
}

// Define DTOs
class UpdateMetadataDto {
    id!: number; // Assuming the file ID is part of the metadata object sent
    metadata!: Record<string, any>;
    content?: string; // Optional content part from original route
}

@ApiTags('files')
@Controller('api/files')
@UseGuards(JwtAuthGuard)
export class FileController {
    constructor(
        private readonly fileService: FileService,
        private readonly logger: Logger
    ) {
        // Using DI for logger
    }

    // Helper to get user/org info - replace with proper guard/decorator later
    private getUserInfo(req: AuthenticatedRequest): { userId: string; organizationId: number } {
        if (!req.user) throw new ForbiddenException('Authentication required');
        const userId = req.user.id;
        const organizationId = typeof req.user.organizationId === 'string' 
                                ? parseInt(req.user.organizationId, 10) 
                                : req.user.organizationId;
        if (!userId || isNaN(organizationId)) {
            throw new BadRequestException('Invalid user or organization information');
        }
        return { userId, organizationId };
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({ type: UploadFileDto })
    @ApiOperation({ summary: 'Upload a file' })
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body() uploadFileDto: UploadFileDto,
        @GetUser() user: User
    ) {
        this.logger.log(`Uploading file: ${file?.originalname} for user: ${user.id}`, 'FileController');
        
        if (!file) {
            throw new BadRequestException('No file uploaded.');
        }

        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        return this.fileService.createFileRecord({
            file,
            userId: user.id, // Pass number ID
            organizationId: organizationId, // Pass placeholder ID
            metadata: uploadFileDto.metadata ? JSON.parse(uploadFileDto.metadata) : undefined
        });
    }

    @Get('status/:fileId')
    @ApiParam({ name: 'fileId', description: 'ID of the file' })
    @ApiOperation({ summary: 'Get file status' })
    async getFileStatus(
        @Param('fileId') fileId: string,
        @GetUser() user: User
    ): Promise<FileStatusDto> {
        this.logger.log(`Getting file status for: ${fileId}, user: ${user.id}`, 'FileController');
        
        if (!fileId) {
            throw new BadRequestException('File ID is required');
        }

        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        // Pass placeholder ID
        return this.fileService.getFileStatus(fileId, organizationId);
    }

    @Get()
    @ApiQuery({ type: UserFilesRequestDto })
    @ApiOperation({ summary: 'Get all files for the authenticated user' })
    async getUserFiles(
        @Query() query: UserFilesRequestDto,
        @GetUser() user: User
    ): Promise<UserFilesResponseDto> {
        const limit = query.limit ?? 10; // Default to 10 if undefined
        const offset = query.offset ?? 0; // Default to 0 if undefined
        
        this.logger.log(`Getting files for user: ${user.id}, limit: ${limit}, offset: ${offset}`, 'FileController');
        
        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        return this.fileService.getUserFiles(
            user.id, // Pass number ID
            organizationId, // Pass placeholder ID
            limit,
            offset
        );
    }

    @Delete(':fileId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiParam({ name: 'fileId', description: 'ID of the file to delete' })
    @ApiOperation({ summary: 'Delete a file' })
    async deleteFile(
        @Param('fileId') fileId: string,
        @GetUser() user: User
    ): Promise<void> {
        this.logger.log(`Deleting file: ${fileId} for user: ${user.id}`, 'FileController');
        
        if (!fileId) {
            throw new BadRequestException('File ID is required');
        }

        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        // Pass placeholder ID
        await this.fileService.deleteFile(fileId, organizationId);
    }

    // Additional methods from existing controller - maintaining current functionality

    @Get('search')
    @ApiQuery({ name: 'q', description: 'Search query term' })
    @ApiOperation({ summary: 'Search for files' })
    async searchFiles(
        @Query('q') searchQuery: string,
        @GetUser() user: User
    ) {
        if (!searchQuery) {
            throw new BadRequestException('Search query is required');
        }
        
        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        // Pass placeholder ID
        return this.fileService.searchFiles(searchQuery, organizationId);
    }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'ID of the file' })
    @ApiOperation({ summary: 'Get file by ID' })
    async getFileById(
        @Param('id') fileId: string,
        @GetUser() user: User
    ) {
        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        // Pass placeholder ID
        return this.fileService.getFileById(fileId, organizationId);
    }

    @Get(':id/content')
    @ApiParam({ name: 'id', description: 'ID of the file' })
    @ApiOperation({ summary: 'Download file content' })
    async getFileContent(
        @Param('id') fileId: string,
        @GetUser() user: User,
        @Res({ passthrough: true }) res: Response
    ): Promise<StreamableFile> {
        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        try {
            // Removed check for non-existent user.organization_id

            // Pass placeholder ID
            const { buffer, fileRecord } = await this.fileService.getFileContent(fileId, organizationId);
            
            res.set({
                'Content-Type': fileRecord.fileType || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileRecord.filename}"`,
                'Content-Length': buffer.length,
            });
            return new StreamableFile(buffer);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            this.logger.error('File content retrieval error:', error);
            throw new InternalServerErrorException('Failed to retrieve file content');
        }
    }
} 