import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface HubSpotCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface HubSpotContact {
  id: string;
  properties: {
    [key: string]: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface HubSpotProperty {
  name: string;
  type: string;
  fieldType: string;
  required: boolean;
  description?: string;
  groupName: string;
}

interface HubSpotPropertiesResponse {
  results: HubSpotProperty[];
}

interface HubSpotContactsResponse {
  results: HubSpotContact[];
  paging?: {
    next?: {
      after?: string;
    };
  };
}

interface HubSpotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('HUBSPOT_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('HUBSPOT_CLIENT_SECRET') || '';
    this.redirectUri = `${this.configService.get<string>('FRONTEND_URL')}/oauth/callback`;
    
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('HubSpot credentials not configured properly');
    }
  }

  /**
   * Exchange authorization code for access token
   * @param code The authorization code from HubSpot
   * @returns HubSpot credentials including access token, refresh token, and expiry
   */
  async exchangeCodeForToken(code: string): Promise<HubSpotCredentials> {
    this.logger.log('Exchanging code for token with HubSpot...');
    
    const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code,
    });

    try {
      this.logger.debug('Making request to HubSpot OAuth endpoint', {
        url: tokenUrl,
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        this.logger.error('Failed to parse HubSpot response', { response: responseText });
        throw new Error('Invalid response from HubSpot');
      }

      if (!response.ok) {
        this.logger.error('HubSpot OAuth error response', {
          status: response.status,
          statusText: response.statusText,
          error: responseData
        });
        throw new Error(`HubSpot OAuth failed: ${responseData.message || response.statusText}`);
      }

      if (!responseData.access_token) {
        this.logger.error('HubSpot response missing access token', { response: responseData });
        throw new Error('Invalid response: missing access token');
      }

      this.logger.log('Successfully received token from HubSpot');
      
      return {
        accessToken: responseData.access_token,
        refreshToken: responseData.refresh_token,
        expiresAt: Date.now() + (responseData.expires_in * 1000),
      };
    } catch (error) {
      this.logger.error('Error exchanging code for token', error);
      throw error;
    }
  }

  /**
   * Refresh an access token using a refresh token
   * @param refreshToken The refresh token
   * @returns New HubSpot credentials
   */
  async refreshAccessToken(refreshToken: string): Promise<HubSpotCredentials> {
    this.logger.log('Refreshing HubSpot access token');

    const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.statusText}`);
      }

      const data = await response.json() as HubSpotTokenResponse;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Some providers don't return a new refresh token
        expiresAt: Date.now() + (data.expires_in * 1000),
      };
    } catch (error) {
      this.logger.error('Error refreshing access token', error);
      throw error;
    }
  }
} 