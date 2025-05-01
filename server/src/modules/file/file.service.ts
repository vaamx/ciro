import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UPLOAD_DIR, ensureOrganizationUploadDir } from '../../common/utils/upload';
import { FileStatusDto, UserFilesResponseDto } from './dto';
import { v4 as uuidv4 } from 'uuid';

// Define file record type based on Prisma schema
export interface DbFileRecord {
    id: string;
    filename: string;
    originalFilename: string;
    fileType: string;
    mimeType: string;
    size: number;
    metadata?: any;
    uploadedBy: string | null;
    organizationId: number | null;
    createdAt: Date;
    updatedAt: Date;
    error?: string | null;
    content?: Uint8Array | null;
}

@Injectable()
export class FileService {
    private readonly logger = new Logger(FileService.name);

    constructor(private readonly prisma: PrismaService) {}

    // Check if a file type is allowed
    isFileTypeAllowed(mimetype: string): boolean {
        const allowedTypes = [
            'application/pdf', 
            'text/csv', 
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/json',
            'text/plain',
            'application/vnd.ms-excel',
            'image/jpeg',
            'image/png',
            'image/gif'
        ];
        return allowedTypes.includes(mimetype);
    }

    // Create a file record in the database and save the file
    async createFileRecord(fileData: {
        file: Express.Multer.File;
        userId: number;
        organizationId: number;
        metadata?: any;
    }): Promise<DbFileRecord> {
        this.logger.log(`Creating file record for ${fileData.file.originalname}`);
        
        // Check file type
        if (!this.isFileTypeAllowed(fileData.file.mimetype)) {
            throw new BadRequestException(`File type ${fileData.file.mimetype} not allowed`);
        }

        try {
            // Ensure upload directory exists
            await ensureOrganizationUploadDir(fileData.organizationId);
            
            // Generate safe filename
            const timestamp = Date.now();
            const safeOriginalName = fileData.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            const uniqueFilename = `${timestamp}-${uuidv4()}-${safeOriginalName}`;
            const filePath = path.join(
                UPLOAD_DIR, 
                'organizations', 
                fileData.organizationId.toString(), 
                uniqueFilename
            );
            
            // Write file to disk
            await fs.writeFile(filePath, fileData.file.buffer);
            
            // Create database record
            const newFile = await this.prisma.file.create({
                data: {
                    filename: uniqueFilename,
                    originalFilename: fileData.file.originalname,
                    mimeType: fileData.file.mimetype,
                    fileType: fileData.file.mimetype,
                    size: BigInt(fileData.file.size),
                    metadata: fileData.metadata ? fileData.metadata : {},
                    uploadedBy: fileData.userId.toString(),
                    organizationId: fileData.organizationId
                }
            });
            
            // Convert BigInt size to Number for JSON serialization
            return {
                ...newFile,
                size: Number(newFile.size)
            } as DbFileRecord;
        } catch (error) {
            this.logger.error('Error creating file record:', error);
            throw new InternalServerErrorException('Failed to save file information');
        }
    }

    // Get file status
    async getFileStatus(fileId: string, organizationId: number): Promise<FileStatusDto> {
        this.logger.log(`Getting status for file ${fileId}`);
        
        try {
            const file = await this.prisma.file.findFirst({
                where: {
                    id: fileId,
                    organizationId: organizationId
                }
            });
            
            if (!file) {
                throw new NotFoundException(`File with ID ${fileId} not found`);
            }
            
            // Determine status from file record
            // This is a placeholder - may need to implement more complex status logic
            return {
                id: file.id,
                status: 'ready', // Default status for existing files
                progress: 100    // Default progress for existing files
            };
        } catch (error) {
            this.logger.error(`Error getting file status for ${fileId}:`, error);
            if (error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException('Failed to retrieve file status');
        }
    }

    // Get files for a user
    async getUserFiles(
        userId: number,
        organizationId: number,
        limit: number,
        offset: number
    ): Promise<UserFilesResponseDto> {
        this.logger.log(`Getting files for user ${userId}, limit: ${limit}, offset: ${offset}`);
        
        try {
            // Get total count
            const totalCount = await this.prisma.file.count({
                where: {
                    organizationId: organizationId
                }
            });
            
            // Get files
            const files = await this.prisma.file.findMany({
                where: {
                    organizationId: organizationId
                },
                skip: offset,
                take: limit,
                orderBy: {
                    createdAt: 'desc'
                }
            });
            
            // Format response
            return {
                files: files.map((file: any) => ({
                    id: file.id,
                    originalFilename: file.originalFilename,
                    size: Number(file.size),
                    mimeType: file.mimeType,
                    uploadedAt: file.createdAt.toISOString(),
                    status: 'ready' // Default status
                })),
                total: totalCount,
                limit,
                offset
            };
        } catch (error) {
            this.logger.error('Error getting user files:', error);
            throw new InternalServerErrorException('Failed to retrieve files');
        }
    }

    // Get file by ID
    async getFileById(fileId: string, organizationId: number): Promise<DbFileRecord> {
        this.logger.log(`Fetching file ${fileId} for org ${organizationId}`);
        
        try {
            const file = await this.prisma.file.findFirst({
                where: {
                    id: fileId,
                    organizationId: organizationId
                }
            });
            
            if (!file) {
                throw new NotFoundException(`File with ID ${fileId} not found`);
            }
            
            // Convert BigInt size to Number for JSON serialization
            return {
                ...file,
                size: Number(file.size)
            } as DbFileRecord;
        } catch (error) {
            this.logger.error(`Error fetching file ${fileId}:`, error);
            if (error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException('Failed to retrieve file');
        }
    }

    // Get file content
    async getFileContent(fileId: string, organizationId: number): Promise<{ buffer: Buffer, fileRecord: DbFileRecord }> {
        this.logger.log(`Retrieving content for file ${fileId}`);
        
         try {
            const fileRecord = await this.getFileById(fileId, organizationId);
            const filePath = path.join(
                UPLOAD_DIR, 
                'organizations', 
                organizationId.toString(), 
                fileRecord.filename
            );
            
            // Ensure file path is within the allowed directory
            const resolvedUploadDir = path.resolve(path.join(UPLOAD_DIR, 'organizations', organizationId.toString()));
            const resolvedFilePath = path.resolve(filePath);
            
            if (!resolvedFilePath.startsWith(resolvedUploadDir)) {
                this.logger.error(`Attempt to access file outside upload directory: ${filePath}`);
                throw new ForbiddenException('Access denied to file path');
            }
            
            const buffer = await fs.readFile(filePath);
            return { buffer, fileRecord };
         } catch (error) {
            this.logger.error(`Error reading file content for ${fileId}:`, error);
            if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
            
            if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
                throw new NotFoundException('File content not found on server');
            }
            
            throw new InternalServerErrorException('Failed to retrieve file content');
         }
    }

    // Delete a file
    async deleteFile(fileId: string, organizationId: number): Promise<void> {
        this.logger.log(`Deleting file ${fileId}`);
        
        try {
            // Get file record first to get filename
            const fileRecord = await this.getFileById(fileId, organizationId);

            // Delete from database first
            await this.prisma.file.delete({
                where: {
                    id: fileId
                }
            });

            // Then try to delete the physical file
            try {
                const filePath = path.join(
                    UPLOAD_DIR, 
                    'organizations', 
                    organizationId.toString(), 
                    fileRecord.filename
                );
                await fs.unlink(filePath);
                this.logger.log(`Deleted physical file: ${filePath}`);
            } catch (unlinkError) {
                 // Log error but don't fail the operation if DB record was deleted
                this.logger.error(`Failed to delete physical file, but DB record removed:`, unlinkError);
            }
        } catch (error) {
             this.logger.error(`Error deleting file ${fileId}:`, error);
            if (error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException('Failed to delete file');
        }
    }

    // Search files
    async searchFiles(query: string, organizationId: number): Promise<DbFileRecord[]> {
         this.logger.log(`Searching files for query "${query}" in org ${organizationId}`);
        
        try {
            const files = await this.prisma.file.findMany({
                where: {
                    organizationId: organizationId,
                    OR: [
                        { filename: { contains: query, mode: 'insensitive' } },
                        { originalFilename: { contains: query, mode: 'insensitive' } }
                    ]
                }
            });
            
            // Convert BigInt size to Number for JSON serialization
            return files.map((file: any) => ({
                ...file,
                size: Number(file.size)
            })) as DbFileRecord[];
        } catch (error) {
             this.logger.error(`Error searching files for query "${query}":`, error);
            throw new InternalServerErrorException('File search failed');
        }
    }
} 