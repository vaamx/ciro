import express from 'express';
import { requireAuth } from '../middleware/auth';
import { HubSpotService } from '../infrastructure/datasource/providers/HubSpotService';
import { pool } from '../infrastructure/database';

export const oauthRouter = express.Router();

// Handle OAuth token exchange
oauthRouter.post('/token', requireAuth, async (req, res) => {
  const { code, provider } = req.body;
  console.log('Token exchange request received:', req.body);

  try {
    switch (provider) {
      case 'hubspot': {
        const hubspotService = new HubSpotService();
        
        try {
          const credentials = await hubspotService.exchangeCodeForToken(code);
          console.log('Successfully exchanged code for HubSpot token');
          
          // Set up data source with the credentials
          await hubspotService.setupDataSource(req.user!.id, credentials);
          console.log('Successfully set up HubSpot data source');

          res.json({ success: true });
        } catch (error) {
          console.error('HubSpot integration error:', error);
          res.status(500).json({ 
            error: 'Failed to integrate with HubSpot',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
        break;
      }
      default:
        res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    res.status(500).json({ 
      error: 'OAuth flow failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Middleware to verify session
export const verifySession = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const sessionToken = req.cookies.session_token;

  if (!sessionToken) {
    console.log('No session token in request');
    return res.status(401).json({ error: 'No session token' });
  }

  try {
    // Get session from database
    const session = await pool.query(
      `SELECT s.*, u.* 
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = $1 AND s.expires_at > NOW()`,
      [sessionToken]
    );

    if (session.rows.length === 0) {
      console.log('No valid session found:', sessionToken);
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Attach user to request
    req.user = session.rows[0];
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(401).json({ error: 'Invalid session token' });
  }
}; 