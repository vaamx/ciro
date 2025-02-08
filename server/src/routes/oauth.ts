import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const router = express.Router();

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// Store tokens in memory (use a proper database in production)
const tokenStore = new Map<string, TokenResponse>();

router.post('/token', async (req, res) => {
  const { code, state, provider } = req.body;

  console.log('Token exchange request received:', { code, state, provider });

  try {
    // Validate required parameters
    if (!code || !state || !provider) {
      const missingParams = [];
      if (!code) missingParams.push('code');
      if (!state) missingParams.push('state');
      if (!provider) missingParams.push('provider');
      
      console.error('Missing required parameters:', missingParams);
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: `Missing: ${missingParams.join(', ')}`
      });
    }

    if (provider === 'hubspot') {
      // Validate environment variables
      if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET) {
        console.error('Missing HubSpot credentials in environment');
        return res.status(500).json({ error: 'HubSpot credentials not configured' });
      }

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', process.env.HUBSPOT_CLIENT_ID);
      params.append('client_secret', process.env.HUBSPOT_CLIENT_SECRET);
      params.append('redirect_uri', `${process.env.FRONTEND_URL}/oauth/callback`);
      params.append('code', code);

      console.log('Starting token exchange with params:', {
        grant_type: 'authorization_code',
        client_id: process.env.HUBSPOT_CLIENT_ID,
        redirect_uri: `${process.env.FRONTEND_URL}/oauth/callback`,
        code: code
      });

      try {
        const tokenResponse = await axios.post(
          'https://api.hubapi.com/oauth/v1/token',
          params.toString(), // Send as string for x-www-form-urlencoded
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            }
          }
        );

        console.log('HubSpot token response received:', {
          status: tokenResponse.status,
          hasAccessToken: !!tokenResponse.data.access_token,
          hasRefreshToken: !!tokenResponse.data.refresh_token,
          responseData: tokenResponse.data
        });

        if (!tokenResponse.data.access_token) {
          console.error('Invalid token response:', tokenResponse.data);
          throw new Error('Invalid token response from HubSpot');
        }

        const tokens: TokenResponse = {
          access_token: tokenResponse.data.access_token,
          refresh_token: tokenResponse.data.refresh_token,
          expires_in: tokenResponse.data.expires_in
        };

        // Generate a session token
        const sessionToken = jwt.sign(
          { provider, state },
          process.env.JWT_SECRET || 'default-secret',
          { expiresIn: '24h' }
        );

        // Store tokens
        tokenStore.set(sessionToken, tokens);
        console.log('Tokens stored successfully:', {
          sessionToken,
          provider,
          state,
          storeSize: tokenStore.size
        });

        // Set session token in cookie with appropriate settings for local development
        res.cookie('session_token', sessionToken, {
          httpOnly: true,
          secure: false, // Allow HTTP for localhost
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({ 
          success: true,
          message: 'Token exchange successful'
        });
      } catch (error: any) {
        console.error('HubSpot API error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          stack: error.stack
        });
        
        // Send a more detailed error response
        res.status(error.response?.status || 500).json({
          error: 'HubSpot API error',
          details: error.response?.data || error.message
        });
      }
    } else {
      console.error('Unsupported provider requested:', provider);
      res.status(400).json({ 
        error: 'Unsupported provider',
        details: `Provider '${provider}' is not supported`
      });
    }
  } catch (error: any) {
    console.error('Token exchange error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Failed to exchange token',
      details: error.response?.data || error.message
    });
  }
});

// Middleware to verify session and attach tokens
export const attachTokens = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const sessionToken = req.cookies.session_token;

  if (!sessionToken) {
    console.log('No session token in request');
    return res.status(401).json({ error: 'No session token' });
  }

  try {
    // Verify session token
    jwt.verify(sessionToken, process.env.JWT_SECRET || 'default-secret');

    // Get tokens from store
    const tokens = tokenStore.get(sessionToken);
    if (!tokens) {
      console.log('No tokens found for session:', sessionToken);
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Attach tokens to request
    (req as any).tokens = tokens;
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(401).json({ error: 'Invalid session token' });
  }
};

export const oauthRouter = router; 