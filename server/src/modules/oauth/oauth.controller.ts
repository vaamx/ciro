import {
  Controller,
  UseGuards,
  Logger,
  Get,
  Query,
  Req,
  Res,
  Injectable
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { HubSpotService } from '../../services/datasources/connectors/hubspot/HubSpotService';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('api/oauth')
@UseGuards(JwtAuthGuard)
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly hubspotService: HubSpotService
  ) {}

  @Get('hubspot')
  hubspotAuth(@Res() res: Response) {
    this.logger.log('Initiating HubSpot OAuth flow...');
    // ... (rest of the auth initiation logic using configService)
    const clientId = this.configService.get<string>('HUBSPOT_CLIENT_ID');
    const redirectUri = `${this.configService.get<string>('FRONTEND_URL')}/oauth/callback`;
    const scopes = ['crm.objects.contacts.read', 'crm.schemas.contacts.read']; // Example scopes
    
    if (!clientId) {
      this.logger.error('HUBSPOT_CLIENT_ID not configured');
      return res.status(500).send('HubSpot integration not configured');
    }

    const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}`;
    res.redirect(authUrl);
  }

  @Get('callback')
  async hubspotCallback(@Query('code') code: string, @Req() req: Request, @Res() res: Response) {
    this.logger.log(`Received HubSpot callback with code: ${code ? 'present' : 'missing'}`);
    if (!code) {
      this.logger.error('HubSpot callback missing authorization code.');
      return res.status(400).send('Authorization code missing');
    }

    try {
      // Exchange code for tokens using the injected service
      const credentials = await this.hubspotService.exchangeCodeForToken(code);
      this.logger.log('Successfully exchanged code for HubSpot tokens.', {
        // Avoid logging sensitive tokens directly
        accessTokenPresent: !!credentials.accessToken,
        refreshTokenPresent: !!credentials.refreshToken,
        expiresAt: credentials.expiresAt
      });

      // TODO: Save the credentials (credentials.accessToken, credentials.refreshToken, credentials.expiresAt)
      // securely, associated with the user (req.user) and potentially link to a DataSource entity.
      // This might involve calling another service (e.g., DataSourceManagementService.createDataSource or .updateDataSourceCredentials).
      // Example placeholder:
      // const user = req.user; // Assuming user info is available from auth middleware
      // await someCredentialService.saveHubSpotCredentials(user.id, credentials);

      // Redirect user back to the frontend application
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || '';
      res.redirect(`${frontendUrl}/connections?success=hubspot`); // Redirect to a success page

    } catch (error) {
      this.logger.error('Error during HubSpot OAuth callback', error);
      res.status(500).send('Failed to authenticate with HubSpot');
    }
  }
} 