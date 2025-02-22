import * as fs from 'fs/promises';
import path from 'path';

// Constants for file paths
export const UPLOAD_DIR = 'uploads';
export const ORGANIZATIONS_DIR = 'organizations';
export const UPLOAD_PATH = path.join(UPLOAD_DIR, ORGANIZATIONS_DIR);

/**
 * Initialize upload directories for the application
 * This should be called once at application startup
 */
export async function initializeUploadDirectories(): Promise<void> {
  try {
    // Create main upload directory with subdirectories
    await fs.mkdir(UPLOAD_PATH, { recursive: true });
    
    // Ensure proper permissions (rwx for owner only)
    await fs.chmod(UPLOAD_DIR, 0o700);
    await fs.chmod(UPLOAD_PATH, 0o700);
    
    console.log('Upload directories initialized successfully');
  } catch (error) {
    console.error('Error initializing upload directories:', error);
    throw error; // Re-throw to let the application handle it
  }
}

/**
 * Get the upload path for a specific organization
 * @param organizationId The ID of the organization
 * @returns The full path to the organization's upload directory
 */
export function getOrganizationUploadPath(organizationId: number): string {
  return path.join(UPLOAD_PATH, organizationId.toString());
}

/**
 * Ensure an organization's upload directory exists
 * @param organizationId The ID of the organization
 */
export async function ensureOrganizationUploadDir(organizationId: number): Promise<void> {
  const orgPath = getOrganizationUploadPath(organizationId);
  await fs.mkdir(orgPath, { recursive: true });
  await fs.chmod(orgPath, 0o700);
} 