import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    UploadedFile,
    UseInterceptors,
    ParseIntPipe
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard'; // Import the real guard
import { GetUser } from '../../core/auth/get-user.decorator'; // Import GetUser decorator
import { User } from '../../core/database/prisma-types'; // Import User type
import { CreateOrganizationDto } from './dto/create-organization.dto'; // Import DTO
import { UpdateOrganizationDto } from './dto/update-organization.dto'; // Import DTO

// Define MulterFile placeholder (or import Express.Multer.File)
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
    filename?: string;
    path?: string;
}

@Controller('api/organizations')
@UseGuards(JwtAuthGuard) // Apply guard to the entire controller
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {}

    @Get()
    async getOrganizations(@GetUser() user: Omit<User, 'password_hash'>) {
        // User ID is directly available from the decorator
        return this.organizationService.findAllByUser(user.id);
    }

    @Post()
    @UseInterceptors(FileInterceptor('logo', {
         limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
         fileFilter: (req, file, cb) => {
             if (file.mimetype.startsWith('image/')) {
                 cb(null, true);
             } else {
                 cb(new BadRequestException('Only image files are allowed'), false);
             }
         },
    }))
    @HttpCode(HttpStatus.CREATED)
    async createOrganization(
        @GetUser() user: Omit<User, 'password_hash'>, 
        @Body() createDto: CreateOrganizationDto,
        @UploadedFile() logo?: MulterFile // Logo is optional
    ) {
        return this.organizationService.create(user.id, createDto, logo);
    }

    @Put(':id')
     @UseInterceptors(FileInterceptor('logo', { /* same options as POST */ 
        limits: { fileSize: 5 * 1024 * 1024 },
         fileFilter: (req, file, cb) => {
             if (file.mimetype.startsWith('image/')) cb(null, true);
             else cb(new BadRequestException('Only image files are allowed'), false);
         }
    }))
    async updateOrganization(
        @GetUser() user: Omit<User, 'password_hash'>,
        @Param('id', ParseIntPipe) orgId: number,
        @Body() updateDto: UpdateOrganizationDto,
        @UploadedFile() logo?: MulterFile // Logo is optional
    ) {
        return this.organizationService.update(user.id, orgId, updateDto, logo);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteOrganization(
        @GetUser() user: Omit<User, 'password_hash'>, 
        @Param('id', ParseIntPipe) orgId: number
    ): Promise<void> {
        await this.organizationService.delete(user.id, orgId);
    }

    // --- Sub-resource routes --- //

    @Get(':organizationId/teams')
    async getOrganizationTeams(
        @GetUser() user: Omit<User, 'password_hash'>, 
        @Param('organizationId', ParseIntPipe) orgId: number
    ) {
        // Permission checks inside the service will use user.id
        return this.organizationService.findTeams(user.id, orgId);
    }

    @Get(':organizationId/categories')
    async getOrganizationCategories(
        @GetUser() user: Omit<User, 'password_hash'>, 
        @Param('organizationId', ParseIntPipe) orgId: number
    ) {
        // Permission checks inside the service will use user.id
        return this.organizationService.findCategories(user.id, orgId);
    }
} 