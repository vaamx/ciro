import { Request, Response } from '../types/express-types';
import { db } from '../infrastructure/db';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Constants for file paths
const UPLOAD_DIR = 'uploads';
const ORGANIZATIONS_DIR = 'organizations';
const UPLOAD_PATH = path.join(UPLOAD_DIR, ORGANIZATIONS_DIR);

// Simple in-memory cache for responses
interface CacheItem {
  data: any;
  timestamp: number;
}

const cache: Record<string, CacheItem> = {};
const CACHE_TTL = 60 * 1000; // 60 seconds 

// Helper function to normalize paths
const normalizePath = (filePath: string) => {
  // Remove leading slash and /files prefix if present
  return filePath.replace(/^\/?(files\/)?/, '').replace(/^\/+/, '');
};

// Helper function to create URL paths (always use forward slashes)
const createUrlPath = (...parts: string[]) => {
  // Filter out empty parts and normalize slashes
  const normalizedParts = parts
    .filter(Boolean)
    .map(part => part.replace(/^\/+|\/+$/g, ''));
  return normalizedParts.join('/');
};

// Helper function to create the final URL for client response
const createClientUrl = (path: string) => {
  if (!path) return undefined;
  const normalizedPath = normalizePath(path);
  return `/${createUrlPath('files', normalizedPath)}`;
};

// Helper function to get filesystem path
const getFilesystemPath = (relativePath: string) => {
  return path.join(UPLOAD_DIR, normalizePath(relativePath));
};

// Helper function to invalidate organization caches
const invalidateOrganizationCache = (userId?: number, organizationId?: number | string) => {
  const keys = Object.keys(cache);
  
  keys.forEach(key => {
    // Invalidate user's organization cache
    if (userId && key.startsWith(`organizations:${userId}`)) {
      delete cache[key];
    }

    // Invalidate specific organization's team cache
    if (organizationId && key.startsWith(`teams:${organizationId}`)) {
      delete cache[key];
    }
    
    // If no params provided, clear all organization-related caches
    if (!userId && !organizationId && (key.startsWith('organizations:') || key.startsWith('teams:'))) {
      delete cache[key];
    }
  });
};

export const organizationController = {
  // Get all organizations for the current user
  async getOrganizations(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const cacheKey = `organizations:${userId}`;
      
      // Check if we have a fresh cached response
      const cachedItem = cache[cacheKey];
      if (cachedItem && (Date.now() - cachedItem.timestamp) < CACHE_TTL) {
        console.log(`Returning cached organizations for user ${userId}`);
        return res.json(cachedItem.data);
      }
      
      // Get organizations with member count in a single query
      const organizations = await db.raw(`
        SELECT 
          o.*,
          COUNT(DISTINCT om.user_id) as member_count
        FROM organizations o
        INNER JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = ?
        GROUP BY o.id
        ORDER BY o.name ASC
      `, [userId]);

      // Add the /files prefix to logo_url in the response
      const processedOrganizations = organizations.rows.map((org: any) => ({
        ...org,
        logo_url: org.logo_url ? createClientUrl(org.logo_url) : null,
        member_count: parseInt(org.member_count)
      }));
      
      // Cache the response
      cache[cacheKey] = {
        data: processedOrganizations,
        timestamp: Date.now()
      };

      res.json(processedOrganizations);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      res.status(500).json({ error: 'Failed to fetch organizations' });
    }
  },

  // Create a new organization
  async createOrganization(req: Request, res: Response) {
    const { name, description } = req.body;
    const logoFile = req.file;
    const userId = req.user!.id;

    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    try {
      let logo_url = null;

      // Create organization in transaction first
      const [organization] = await db.transaction(async (trx) => {
        // Create the organization
        const [org] = await trx('organizations')
          .insert({
            name,
            description,
            logo_url: null, // We'll update this after saving the file
            settings: '{}',
          })
          .returning('*');

        console.log('Created organization:', org);

        // Add the creator as an admin
        await trx('organization_members').insert({
          organization_id: org.id,
          user_id: req.user!.id,
          role: 'admin',
        });

        // Update the user's organization_id
        await trx('users')
          .where('id', req.user!.id)
          .update({
            organization_id: org.id,
            updated_at: trx.fn.now()
          });

        return [org];
      });

      // Now that we have the organization ID, handle the logo file if it exists
      if (logoFile && logoFile.buffer) {
        try {
          // Ensure upload directory exists
          await fs.mkdir(UPLOAD_PATH, { recursive: true });

          // Process the uploaded image
          const optimizedImageBuffer = await sharp(logoFile.buffer)
            .resize(256, 256, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();

          // Generate a unique filename
          const optimizedFilename = `logo_${organization.id}_${Date.now()}.jpg`;
          const optimizedPath = path.join(UPLOAD_PATH, optimizedFilename);
          
          console.log('Saving optimized image:', { 
            filename: optimizedFilename,
            path: optimizedPath 
          });

          // Save the optimized image
          await fs.writeFile(optimizedPath, optimizedImageBuffer);

          // Set the logo URL - store only the relative path
          logo_url = createUrlPath(ORGANIZATIONS_DIR, optimizedFilename);
          console.log('Setting logo URL:', { logo_url });

          // Update the organization with the logo URL
          await db('organizations')
            .where('id', organization.id)
            .update({ logo_url })
            .returning('*');
        } catch (error) {
          console.error('Error processing logo:', error);
          // Continue without logo if there's an error
        }
      }

      // Add the /files prefix to logo_url in the response
      if (logo_url) {
        organization.logo_url = createClientUrl(logo_url);
        console.log('Final organization response:', { 
          original: logo_url,
          final: organization.logo_url 
        });
      }

      // Invalidate the user's organization cache
      invalidateOrganizationCache(userId);

      res.status(201).json(organization);
    } catch (error) {
      console.error('Error creating organization:', error);
      res.status(500).json({ error: 'Failed to create organization' });
    }
  },

  // Update an organization
  async updateOrganization(req: Request, res: Response) {
    const { id } = req.params;
    const { name, description } = req.body;
    const logoFile = req.file;
    const userId = req.user!.id;

    try {
      // Check if user has admin rights
      const member = await db('organization_members')
        .where({
          organization_id: id,
          user_id: req.user!.id,
          role: 'admin',
        })
        .first();

      if (!member) {
        return res.status(403).json({ error: 'Not authorized to update this organization' });
      }

      let logo_url;
      if (logoFile) {
        // Ensure upload directory exists
        await fs.mkdir(UPLOAD_PATH, { recursive: true });

        // Process the uploaded image from buffer instead of path
        const optimizedImageBuffer = await sharp(logoFile.buffer)
          .resize(256, 256, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();

        // Generate a unique filename
        const optimizedFilename = `logo_${id}_${Date.now()}.jpg`;
        const optimizedPath = path.join(UPLOAD_PATH, optimizedFilename);
        
        console.log('Saving optimized image:', { 
          filename: optimizedFilename,
          path: optimizedPath 
        });

        // Save the optimized image
        await fs.writeFile(optimizedPath, optimizedImageBuffer);

        // Set the logo URL - store only the relative path
        logo_url = createUrlPath(ORGANIZATIONS_DIR, optimizedFilename);
        console.log('Setting logo URL:', { logo_url });

        // Delete old logo if it exists
        const oldOrg = await db('organizations').where('id', id).first();
        if (oldOrg.logo_url) {
          const normalizedPath = normalizePath(oldOrg.logo_url);
          const oldLogoPath = path.join(UPLOAD_DIR, normalizedPath);
          try {
            await fs.unlink(oldLogoPath);
          } catch (unlinkError) {
            console.error('Error deleting old logo:', unlinkError);
          }
        }
      }

      const [organization] = await db('organizations')
        .where('id', id)
        .update({
          name: name || undefined,
          description: description || undefined,
          logo_url: logo_url || undefined,
          updated_at: db.fn.now(),
        })
        .returning('*');

      // Add the /files prefix to logo_url in the response
      if (organization.logo_url) {
        organization.logo_url = createClientUrl(organization.logo_url);
      }

      // Invalidate both organization and team caches
      invalidateOrganizationCache(userId, id);

      res.json(organization);
    } catch (error) {
      console.error('Error updating organization:', error);
      res.status(500).json({ error: 'Failed to update organization' });
    }
  },

  // Delete an organization
  async deleteOrganization(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;

    try {
      // Check if user has admin rights
      const member = await db('organization_members')
        .where({
          organization_id: id,
          user_id: req.user!.id,
          role: 'admin',
        })
        .first();

      if (!member) {
        return res.status(403).json({ error: 'Not authorized to delete this organization' });
      }

      // Get organization to delete logo if it exists
      const org = await db('organizations').where('id', id).first();
      
      await db.transaction(async (trx) => {
        // Delete the organization
        await trx('organizations').where('id', id).delete();

        // Delete the logo file if it exists
        if (org.logo_url) {
          const normalizedPath = normalizePath(org.logo_url);
          const logoPath = path.join(UPLOAD_DIR, normalizedPath);
          try {
            await fs.unlink(logoPath);
          } catch (unlinkError) {
            console.error('Error deleting logo file:', unlinkError);
          }
        }
      });

      // Invalidate both organization and team caches
      invalidateOrganizationCache(userId, id);

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting organization:', error);
      res.status(500).json({ error: 'Failed to delete organization' });
    }
  },

  // Get organization teams
  async getOrganizationTeams(req: Request, res: Response) {
    const { organizationId } = req.params;
    const userId = req.user!.id;
    
    try {
      const cacheKey = `teams:${organizationId}:${userId}`;
      
      // Check if we have a fresh cached response
      const cachedItem = cache[cacheKey];
      if (cachedItem && (Date.now() - cachedItem.timestamp) < CACHE_TTL) {
        console.log(`Returning cached teams for organization ${organizationId} and user ${userId}`);
        return res.json(cachedItem.data);
      }
    
      // Check if user is a member of the organization
      const member = await db('organization_members')
        .where({
          organization_id: organizationId,
          user_id: userId,
        })
        .first();

      if (!member) {
        return res.status(403).json({ error: 'Not authorized to view teams in this organization' });
      }

      const teams = await db('teams')
        .where('organization_id', organizationId)
        .select('*');
        
      // Cache the response
      cache[cacheKey] = {
        data: teams,
        timestamp: Date.now()
      };

      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  },

  // Get organization categories
  async getOrganizationCategories(req: Request, res: Response) {
    const { organizationId } = req.params;

    try {
      // Check if user is a member of the organization
      const member = await db('organization_members')
        .where({
          organization_id: organizationId,
          user_id: req.user!.id,
        })
        .first();

      if (!member) {
        return res.status(403).json({ error: 'Not authorized to view categories in this organization' });
      }

      const categories = await db('categories')
        .where('organization_id', organizationId)
        .select('*');

      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  },
}; 