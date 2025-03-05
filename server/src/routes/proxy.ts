import express, { RequestHandler } from 'express';
import { verifySession } from './oauth';
import { HubSpotService } from '../infrastructure/datasource/providers/HubSpotService';

const router = express.Router();

// Use session verification middleware
router.use(verifySession as RequestHandler);

// Proxy requests to HubSpot
router.all('/hubspot/*', async (req: express.Request, res: express.Response) => {
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
});

// Add more provider-specific proxy routes here
// Example: Salesforce, Google Drive, etc.

export const proxyRouter = router; 