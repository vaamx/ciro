import express, { Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { HubSpotService } from '../infrastructure/datasource/providers/HubSpotService';
import { db } from '../infrastructure/database';

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
      organizationId: string;
    };
  }
}

export const oauthRouter = express.Router();

// Use authentication middleware
oauthRouter.use(authenticate);

// Handle OAuth token exchange
oauthRouter.post('/token', (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const { code, provider } = authReq.body;
  console.log('Token exchange request received:', authReq.body);

  (async () => {
    try {
      switch (provider) {
        case 'hubspot': {
          const hubspotService = new HubSpotService();
          
          try {
            const credentials = await hubspotService.exchangeCodeForToken(code);
            console.log('Successfully exchanged code for HubSpot token');
            
            // Set up data source with the credentials
            await hubspotService.setupDataSource(authReq.user.id, credentials);
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
      next(error);
    }
  })().catch(next);
});

// Middleware to verify session
export const verifySession = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const sessionToken = req.cookies.session_token;

  if (!sessionToken) {
    console.log('No session token in request');
    return res.status(401).json({ error: 'No session token' });
  }

  try {
    // Get session from database
    const session = await db('sessions')
      .join('users', 'sessions.user_id', 'users.id')
      .where('sessions.session_token', sessionToken)
      .whereRaw('sessions.expires_at > NOW()')
      .select('users.id', 'users.email', 'users.role', 'users.organization_id as organizationId')
      .first();

    if (!session) {
      console.log('No valid session found:', sessionToken);
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Attach user to request
    req.user = session;
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(401).json({ error: 'Invalid session token' });
  }
};

// Get all OAuth connections for the current user
oauthRouter.get('/connections', (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  
  (async () => {
    try {
      const connections = await db('oauth_tokens')
        .select('provider', 'created_at', 'updated_at')
        .where('user_id', authReq.user.id);
      
      res.json(connections);
    } catch (error) {
      console.error('Error fetching OAuth connections:', error);
      res.status(500).json({ error: 'Failed to fetch OAuth connections' });
    }
  })().catch(error => {
    console.error('Unexpected error in /connections route:', error);
    res.status(500).json({ error: 'Internal server error' });
  });
}); 