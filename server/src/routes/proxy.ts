import express from 'express';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifySession } from './oauth';
import { HubSpotService } from '../infrastructure/datasources/providers/HubSpotService';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

// Use session verification middleware
router.use(((req: Request, res: Response, next: NextFunction) => 
  verifySession(req as AuthRequest, res, next)) as unknown as RequestHandler);

// Proxy requests to HubSpot
router.all('/hubspot/*', (async (req: Request, res: Response) => {
  try {
    const hubspotService = new HubSpotService();
    // Forward the request to HubSpot
    // Implementation details...
    res.json({ success: true });
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to proxy request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// Add more provider-specific proxy routes here
// Example: Salesforce, Google Drive, etc.

export const proxyRouter = router; 