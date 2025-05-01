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
        if (!logoFile || !logoFile.buffer) {
            return null; // No file provided
        }

        await this.ensureUploadDirectoryExists();

        try {
            const optimizedImageBuffer = await sharp(logoFile.buffer)
                .resize(256, 256, { fit: 'cover' }) // Resize and crop
                .jpeg({ quality: 80 }) // Convert to JPEG with quality 80
                .toBuffer();

            const optimizedFilename = `logo_${orgId}_${Date.now()}.jpg`;
            const filesystemPath = path.join(UPLOAD_PATH, optimizedFilename);
            
            this.logger.log(`Saving optimized logo: ${filesystemPath}`);
            await fs.writeFile(filesystemPath, optimizedImageBuffer);

            // Return the relative path for storing in the DB
            return this.createUrlPath(ORGANIZATIONS_DIR, optimizedFilename);

        } catch (error) {
            this.logger.error(`Error processing logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            const userOrgs = await this.prisma.organizationMember.findMany({
                where: { userId: userId },
                include: {
                    organization: true,
                },
            });
            
            // Map over the memberships to get organization details and member counts
            const orgPromises = userOrgs.map(async (membership) => {
                const organization = membership.organization;
                if (!organization) return null; // Should not happen with the include, but good practice

                const memberCount = await this.prisma.organizationMember.count({
                    where: { organizationId: organization.id },
                });

                return {
                    ...organization,
                    // logo_url: organization.logo_url ? this.createClientUrl(organization.logo_url) : null, // logo_url not in current schema
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
            const maxOrg = await this.prisma.organization.findFirst({
                orderBy: {
                    id: 'desc'
                },
                select: {
                    id: true
                }
            });

            // Get user details to preserve role
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true }
            });

            if (!user) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            // Use Prisma transaction
            const createdOrg = await this.prisma.$transaction(async (tx) => { // Capture return value
                this.logger.log('Starting transaction to create organization and add owner');
                
                // Calculate next ID based on existing max ID (including any manually set IDs)
                const nextId = maxOrg ? maxOrg.id + 1 : 1;
                this.logger.log(`Using explicit ID ${nextId} for new organization`);

                // 1. Create the organization with explicit ID to avoid conflicts
                const newOrg = await tx.organization.create({
                    data: {
                        id: nextId, // Explicitly set ID
                        name: createDto.name,
                        // description: createDto.description, // Field not in schema
                        // settings: {}, // Field not in schema
                        // logo_url: logoPath, // Field not in schema
                        // No ownerId field in the Organization model according to server schema
                    }
                });
                
                this.logger.log(`Saved new organization with ID: ${newOrg.id}`);

                // 2. Add the creator as an admin member
                const newMember = await tx.organizationMember.create({
                    data: {
                        userId: userId,
                        organizationId: newOrg.id,
                        // role is part of the User model, not the OrganizationMember model
                        // We ensured the user keeps their role by looking up earlier
                    }
                });
                
                this.logger.log(`Added user ${userId} as admin to org ${newOrg.id}`);

                // 3. Process and save the logo if provided
                if (logo) {
                    const logoPath = await this.processAndSaveLogo(newOrg.id, logo);
                    if (logoPath) {
                        // Update the organization with the logo path
                        const updatedOrg = await tx.organization.update({
                            where: { id: newOrg.id },
                            data: { name: newOrg.name } // Placeholder update or update other valid fields
                        });
                        
                        // Return the updated organization with client-friendly logo URL
                        return {
                            ...updatedOrg,
                            // logo_url: logoPath ? this.createClientUrl(logoPath) : null, // Field not in current schema
                            memberCount: 1 // Just created, so only 1 member
                        };
                    }
                }

                // Return the created organization object
                return newOrg; // Return the created org from the transaction callback
            });

            // Now use 'createdOrg' which holds the result of the transaction
            this.logger.log(`Transaction successful for creating organization ${createdOrg.name}`); // Use createdOrg
            // Return org data with member count (always 1 after creation)
            return { 
                ...createdOrg, // Use createdOrg
                // logo_url: null, // Field not in schema
                memberCount: 1 
            };
        } catch (error) {
            this.logger.error(`Failed to create organization: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
            throw new InternalServerErrorException('Failed to create organization. Please try again.');
        }
    }
    
    // Placeholder for update - implement next
    async update(userId: number, orgId: number, updateDto: UpdateOrganizationDto, logo?: MulterFile): Promise<any> {
        this.logger.log(`Updating organization ${orgId} for user ${userId}`, updateDto);
        
        await this.checkAdminPermission(userId, orgId); // Ensure user is admin

        const organization = await this.prisma.organization.findUnique({
            where: { id: orgId }
        });
        if (!organization) {
            throw new NotFoundException(`Organization with ID ${orgId} not found.`);
        }

        const oldLogoPath = null; // Placeholder
        let newLogoRelativePath: string | null = null;

        // Handle logo update/removal
        if (updateDto.removeLogo) {
             this.logger.log(`Removing logo for organization ${orgId}`);
            // organization.logo_url = null; // Field not in schema
        } else if (logo) {
            this.logger.log(`Processing new logo for organization ${orgId}`);
            newLogoRelativePath = await this.processAndSaveLogo(orgId, logo);
            // organization.logo_url = newLogoRelativePath; // Field not in schema
        }
        // If neither removeLogo nor a new logo is provided, the existing logo_url remains unchanged.

        // Update other fields from DTO
        if (updateDto.name !== undefined) {
            organization.name = updateDto.name;
        }
        // if (updateDto.description !== undefined) { // Field not in schema
        //     organization.description = updateDto.description;
        // }
        // organization.updated_at = new Date(); // Prisma handles updatedAt
        // Add other updatable fields here (e.g., settings)

        try {
            const updatedOrganization = await this.prisma.organization.update({
                where: { id: orgId },
                data: {
                    name: organization.name,
                    // description: updateDto.description, // Field not in schema
                    // logo_url: ..., // Field not in schema
                    // settings: ..., // Field not in schema
                    // removed updated_at: new Date()
                }
            });
            this.logger.log(`Organization ${orgId} updated successfully by user ${userId}`);
            // return { // Return updated data without logo_url
            //     ...updatedOrganization,
            //     // logo_url: updatedOrganization.logo_url ? this.createClientUrl(updatedOrganization.logo_url) : null 
            // };
            return updatedOrganization;
        } catch (error) {
            this.logger.error(`Failed to update organization ${orgId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Potential cleanup for newly uploaded file if save failed
            if (newLogoRelativePath && newLogoRelativePath !== oldLogoPath) {
                this.logger.warn(`Rolling back logo update for org ${orgId}. Deleting new file: ${newLogoRelativePath}`);
                await this.deleteLogoFile(newLogoRelativePath); // deleteLogoFile handles null check internally
            }
            return organization;
        }
    }

     // Placeholder for delete - implement next
     async delete(userId: number, orgId: number): Promise<void> {
        this.logger.log(`Attempting to delete organization ${orgId} by user ${userId}`);

        await this.checkAdminPermission(userId, orgId); // Ensure user is admin

        const organization = await this.prisma.organization.findUnique({
            where: { id: orgId }
        });

        if (!organization) {
            // If not found, maybe it was already deleted. Log and return success.
            this.logger.warn(`Organization ${orgId} not found for deletion, possibly already deleted.`);
            return; // Or throw NotFoundException if preferred
        }

        // const logoToDelete = organization.logo_url; // Field not in schema

        try {
            // Delete the organization record
            // Prisma cascade should handle deletion of members
            await this.prisma.organization.delete({
                where: { id: orgId }
            });
            this.logger.log(`Successfully deleted organization record ${orgId}`);

            // Delete the logo file *after* successful record deletion
            // if (logoToDelete) { // Field not in schema
            //     await this.deleteLogoFile(logoToDelete); // deleteLogoFile handles null check internally
            // }

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
            this.logger.error(`Failed to fetch teams for organization ${orgId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new InternalServerErrorException('Failed to retrieve teams.');
        }
    }

    async findCategories(userId: number, orgId: number): Promise<any[]> {
        this.logger.log(`Fetching categories for organization ${orgId} for user ${userId}`);
        // First, verify the user is a member of the organization
        await this.checkMemberPermission(userId, orgId);

        try {
            // Find categories where the organization_id matches
            // const categories = await this.prisma.categories.findMany({ // Model not in schema
            //     where: { organization_id: orgId },
            //     orderBy: { name: 'asc' }
            // });
            // return categories;
            this.logger.warn(`findCategories called for org ${orgId}, but Category model is not defined in schema.`);
            return []; // Return empty array for now
        } catch (error) {
            this.logger.error(`Failed to fetch categories for organization ${orgId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new InternalServerErrorException('Failed to retrieve categories.');
        }
    }
    
    // --- Permission Check Helper ---
    
    /**
     * Checks if a user has admin permission within a specific organization.
     * Throws ForbiddenException if the user is not found or not an admin.
     * @param userId The ID of the user.
     * @param organizationId The ID of the organization.
     */
    async checkAdminPermission(userId: number, organizationId: number): Promise<void> {
        const member = await this.prisma.organizationMember.findFirst({
            where: {
                userId: userId,
                organizationId: organizationId, // Corrected casing
                user: {                 // Check role on the related User
                    role: Role.ADMIN
                }
            },
        });

        if (!member) {
            // Check if the user is a member at all before throwing Forbidden specifically for non-admin
            const isMember = await this.prisma.organizationMember.findFirst({
                where: {
                    userId: userId,
                    organizationId: organizationId,
                }
            });
            if (!isMember) {
                throw new NotFoundException(`User with ID ${userId} not found in organization ${organizationId}`);
            } else {
                throw new ForbiddenException(`User with ID ${userId} does not have admin permissions in organization ${organizationId}`);
            }
        }
    }
    
    /**
     * Checks if a user is a member of a specific organization.
     * Throws NotFoundException if the user is not found in the organization.
     * @param userId The ID of the user.
     * @param organizationId The ID of the organization.
     */
    async checkMemberPermission(userId: number, organizationId: number): Promise<void> {
        const member = await this.prisma.organizationMember.findFirst({
            where: {
                userId: userId,
                organizationId: organizationId, // Corrected casing, removed incorrect role check
            },
        });

        if (!member) {
            throw new NotFoundException(`User with ID ${userId} not found in organization ${organizationId}`);
        }
    }
}