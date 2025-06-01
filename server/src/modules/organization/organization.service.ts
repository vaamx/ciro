import { 
    Injectable, 
    NotFoundException, 
    InternalServerErrorException, 
    Logger, 
    ForbiddenException, 
    BadRequestException 
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { Role } from '@prisma/client';

// Define MulterFile placeholder if not globally defined
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

// Constants for file paths - Consider making these configurable
const UPLOAD_DIR = 'uploads'; // Base upload directory
const ORGANIZATIONS_DIR = 'organizations'; // Subdirectory for organization assets
const UPLOAD_PATH = path.join(UPLOAD_DIR, ORGANIZATIONS_DIR); // Full path for organization uploads

@Injectable()
export class OrganizationService {
    private readonly logger = new Logger(OrganizationService.name); // Use NestJS Logger

    constructor(
        private readonly prisma: PrismaService,
    ) {}

    // --- Helper Functions (Migrated & Adapted) ---

    private normalizePath(filePath: string): string {
        if (!filePath) return '';
        // Remove leading slash and /files prefix if present, ensure no leading slash remains
        return filePath.replace(/^\/?(files\/)?/, '').replace(/^\/+/, '');
    }

    private createUrlPath(...parts: string[]): string {
        // Filter out empty parts and normalize slashes, join with forward slashes
        const normalizedParts = parts
            .filter(Boolean)
            .map(part => part.replace(/^\/+|\/+$/g, '')); // Remove leading/trailing slashes
        return normalizedParts.join('/'); // Use forward slashes for URLs
    }

    private createClientUrl(relativePath: string): string | null {
        if (!relativePath) return null;
        const normalizedPath = this.normalizePath(relativePath);
        // Always prepend '/files/' for client-side URLs
        return `/${this.createUrlPath('files', normalizedPath)}`;
    }

    private getFilesystemPath(relativePath: string): string {
         if (!relativePath) throw new Error("Cannot get filesystem path for empty relative path");
        // Joins the base UPLOAD_DIR with the normalized relative path
        return path.join(UPLOAD_DIR, this.normalizePath(relativePath));
    }
    
    private async ensureUploadDirectoryExists(): Promise<void> {
        try {
            await fs.mkdir(UPLOAD_PATH, { recursive: true });
            this.logger.log(`Ensured upload directory exists: ${UPLOAD_PATH}`);
        } catch (error) {
            this.logger.error(`Failed to create upload directory ${UPLOAD_PATH}`, error);
            throw new InternalServerErrorException('Failed to prepare upload directory.');
        }
    }
    
     private async processAndSaveLogo(orgId: number, logoFile: MulterFile): Promise<string | null> {
        this.logger.log(`Starting logo processing for org ${orgId}`);
        
        if (!logoFile) {
            this.logger.warn(`No logo file provided for org ${orgId}`);
            return null;
        }

        // Debug: Log all available properties of the file object
        this.logger.log(`File object properties: ${JSON.stringify({
            fieldname: logoFile.fieldname,
            originalname: logoFile.originalname,
            encoding: logoFile.encoding,
            mimetype: logoFile.mimetype,
            size: logoFile.size,
            hasBuffer: !!logoFile.buffer,
            bufferLength: logoFile.buffer?.length,
            // Include any other properties that might be present
            ...Object.keys(logoFile).reduce((acc, key) => {
                if (!['buffer'].includes(key)) {
                    acc[key] = (logoFile as any)[key];
                }
                return acc;
            }, {} as any)
        }, null, 2)}`);
        
        if (!logoFile.buffer) {
            this.logger.warn(`No logo file buffer provided for org ${orgId}`);
            return null;
        }

        this.logger.log(`Logo file buffer size: ${logoFile.buffer.length} bytes`);

        try {
            await this.ensureUploadDirectoryExists();
            this.logger.log(`Upload directory verified for org ${orgId}`);
        } catch (dirError) {
            this.logger.error(`Failed to ensure upload directory exists: ${dirError instanceof Error ? dirError.message : 'Unknown error'}`);
            return null;
        }

        try {
            this.logger.log(`Processing image with Sharp for org ${orgId}`);
            const optimizedImageBuffer = await sharp(logoFile.buffer)
                .resize(256, 256, { fit: 'cover' }) // Resize and crop
                .jpeg({ quality: 80 }) // Convert to JPEG with quality 80
                .toBuffer();
            
            this.logger.log(`Image processed successfully. Optimized size: ${optimizedImageBuffer.length} bytes`);

            const optimizedFilename = `logo_${orgId}_${Date.now()}.jpg`;
            const filesystemPath = path.join(UPLOAD_PATH, optimizedFilename);
            
            this.logger.log(`Saving optimized logo to: ${filesystemPath}`);
            await fs.writeFile(filesystemPath, optimizedImageBuffer);
            this.logger.log(`Logo file written successfully to filesystem`);

            // Return the relative path for storing in the DB
            const relativePath = this.createUrlPath(ORGANIZATIONS_DIR, optimizedFilename);
            this.logger.log(`Returning relative path: ${relativePath}`);
            return relativePath;

        } catch (error) {
            this.logger.error(`Error processing logo for org ${orgId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
            return null;
        }
    }
    
    private async deleteLogoFile(relativePath: string | null): Promise<void> {
        if (!relativePath) return; // No file to delete

        try {
            const filesystemPath = this.getFilesystemPath(relativePath);
            await fs.unlink(filesystemPath);
            this.logger.log(`Deleted logo file: ${filesystemPath}`);
        } catch (error) {
            this.logger.warn(`Failed to delete logo file at path: ${relativePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Non-critical error, log but don't throw
        }
    }

    // --- Service Methods ---

    async findAllByUser(userId: number): Promise<any[]> {
        this.logger.log(`Finding organizations for user ${userId}`);
        try {
            // Fetch all organization memberships for the user
            this.logger.debug(`Fetching organizations for user ID: ${userId}`);
            const userOrgs = await this.prisma.organization_members.findMany({
                where: { user_id: userId },
                include: {
                    organizations: true,
                },
            });
            
            // Map over the memberships to get organization details and member counts
            const orgPromises = userOrgs.map(async (membership) => {
                const organization = membership.organizations;
                if (!organization) return null; // Should not happen with the include, but good practice

                const memberCount = await this.prisma.organization_members.count({
                    where: { organization_id: organization.id },
                });

                return {
                    ...organization,
                    logo_url: organization.logo_url ? this.createClientUrl(organization.logo_url) : null,
                    memberCount
                };
            });
            
            // Wait for all promises to resolve
            const orgPromisesResult = await Promise.all(orgPromises);
            
            // Filter out any null results (e.g., if an org was deleted concurrently)
            const validOrgs = orgPromisesResult.filter(org => org !== null);
            
            // Sort organizations alphabetically by name
            // Add explicit types for sort parameters to fix implicit any
            return validOrgs.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
        } catch (error) {
            this.logger.error(`Failed to fetch organizations for user ${userId}:`, error);
            throw new InternalServerErrorException('Failed to retrieve organizations.');
        }
    }

    // Placeholder for create - implement next
    async create(userId: number, createDto: CreateOrganizationDto, logo?: MulterFile): Promise<any> {
        this.logger.log(`Creating organization '${createDto.name}' for user ${userId}`);

        try {
            // Before transaction, find the max organization ID to prevent conflicts
            const maxOrg = await this.prisma.organizations.findFirst({
                orderBy: {
                    id: 'desc'
                },
                select: {
                    id: true
                }
            });

            // Get user details to preserve role
            const user = await this.prisma.users.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    role: true
                }
            });

            if (!user) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            this.logger.log(`User found: ${user.id} with role: ${user.role}`);

            let logoUrl: string | null = null;
            if (logo) {
                this.logger.log(`Processing logo: ${logo.originalname}`);
                logoUrl = await this.processAndSaveLogo(maxOrg ? maxOrg.id + 1 : 1, logo);
                this.logger.log(`Logo saved to: ${logoUrl}`);
            }

            // Use transaction to ensure both operations succeed
            const createdOrg = await this.prisma.$transaction(async (tx) => {
                // Create the organization with logo_url
                const org = await tx.organizations.create({
                    data: {
                        name: createDto.name,
                        logo_url: logoUrl,
                        updated_at: new Date()
                    }
                });

                this.logger.log(`Organization created with ID: ${org.id}`);

                // Create organization membership for the creator as the initial admin
                await tx.organization_members.create({
                    data: {
                        user_id: userId,
                        organization_id: org.id
                    }
                });

                this.logger.log(`User ${userId} added as member of organization ${org.id}`);

                return org;
            });

            // Return created organization with proper structure
            return {
                id: createdOrg.id,
                name: createdOrg.name,
                logo_url: createdOrg.logo_url ? this.createClientUrl(createdOrg.logo_url) : null,
                created_at: createdOrg.created_at,
                updated_at: createdOrg.updated_at
            };
        } catch (error: any) {
            this.logger.error(`Failed to create organization: ${error?.message || 'Unknown error'}`, error?.stack);
            throw new InternalServerErrorException(`Failed to create organization: ${error?.message || 'Unknown error'}`);
        }
    }
    
    // Placeholder for update - implement next
    async update(
        userId: number,
        organizationId: number,
        updateDto: UpdateOrganizationDto,
        logo?: MulterFile
    ): Promise<any> {
        this.logger.log(`Updating organization ${organizationId} by user ${userId}`);

        try {
            // Check permissions
            await this.checkAdminPermission(userId, organizationId);

            let logoUrl: string | null = null;
            let logoProcessed = false;
            
            if (logo) {
                this.logger.log(`Processing new logo: ${logo.originalname}, size: ${logo.size}, type: ${logo.mimetype}`);
                logoUrl = await this.processAndSaveLogo(organizationId, logo);
                logoProcessed = true;
                this.logger.log(`Logo processing completed. Result: ${logoUrl}`);
            }

            // Prepare update data
            const updateData: any = {};
            if (updateDto.name) {
                updateData.name = updateDto.name;
            }
            
            // Always update logo_url if a logo was provided, even if processing failed
            if (logoProcessed) {
                updateData.logo_url = logoUrl;
                this.logger.log(`Will update logo_url to: ${logoUrl}`);
            }

            this.logger.log(`Update data prepared:`, updateData);

            // Update the organization
            const updatedOrg = await this.prisma.organizations.update({
                where: { id: organizationId },
                data: updateData
            });

            this.logger.log(`Organization ${organizationId} updated successfully. New logo_url: ${updatedOrg.logo_url}`);

            return {
                id: updatedOrg.id,
                name: updatedOrg.name,
                logo_url: updatedOrg.logo_url ? this.createClientUrl(updatedOrg.logo_url) : null,
                created_at: updatedOrg.created_at,
                updated_at: updatedOrg.updated_at
            };
        } catch (error: any) {
            this.logger.error(`Failed to update organization: ${error?.message || 'Unknown error'}`, error?.stack);
            throw new InternalServerErrorException(`Failed to update organization: ${error?.message || 'Unknown error'}`);
        }
    }

     // Placeholder for delete - implement next
     async delete(userId: number, orgId: number): Promise<void> {
        this.logger.log(`Attempting to delete organization ${orgId} by user ${userId}`);

        await this.checkAdminPermission(userId, orgId); // Ensure user is admin

        const organization = await this.prisma.organizations.findUnique({
            where: { id: orgId }
        });

        if (!organization) {
            // If not found, maybe it was already deleted. Log and return success.
            this.logger.warn(`Organization ${orgId} not found for deletion, possibly already deleted.`);
            return; // Or throw NotFoundException if preferred
        }

        const logoToDelete = organization.logo_url;

        try {
            // Delete the organization record
            // Prisma cascade should handle deletion of members
            await this.prisma.organizations.delete({
                where: { id: orgId }
            });
            this.logger.log(`Successfully deleted organization record ${orgId}`);

            // Delete the logo file *after* successful record deletion
            if (logoToDelete) {
                await this.deleteLogoFile(logoToDelete);
            }

        } catch (error) {
            this.logger.error(`Failed to delete organization ${orgId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new InternalServerErrorException('Failed to delete organization.');
        }
    }
    
    async findTeams(userId: number, orgId: number): Promise<any[]> {
        this.logger.log(`Fetching teams for organization ${orgId} for user ${userId}`);
        // First, verify the user is a member of the organization
        await this.checkMemberPermission(userId, orgId);

        try {
            // Find teams where the organization_id matches
            // const teams = await this.prisma.teams.findMany({ // Model not in schema
            //     where: { organization_id: orgId },
            //     orderBy: { name: 'asc' }
            // });
            // return teams;
            this.logger.warn(`findTeams called for org ${orgId}, but Team model is not defined in schema.`);
            return []; // Return empty array for now
        } catch (error) {
            this.logger.error(`Failed to fetch teams for organization ${orgId}:`, error);
            throw new InternalServerErrorException('Failed to retrieve teams.');
        }
    }

    // Add missing permission check methods
    private async checkAdminPermission(userId: number, organizationId: number): Promise<void> {
        const membership = await this.prisma.organization_members.findFirst({
            where: {
                user_id: userId,
                organization_id: organizationId
            }
        });

        if (!membership) {
            throw new ForbiddenException('User is not a member of this organization');
        }

        // Add admin role check if needed
        // For now, assuming all members can update organization details
    }

    private async checkMemberPermission(userId: number, orgId: number): Promise<void> {
        const membership = await this.prisma.organization_members.findFirst({
            where: {
                user_id: userId,
                organization_id: orgId
            }
        });

        if (!membership) {
            throw new ForbiddenException('You are not a member of this organization.');
        }
    }
}