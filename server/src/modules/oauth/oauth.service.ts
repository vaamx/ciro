import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider } from './dto/token-exchange.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async exchangeHubspotToken(code: string, redirectUri: string) {
    const clientId = this.configService.get<string>('HUBSPOT_CLIENT_ID');
    const clientSecret = this.configService.get<string>('HUBSPOT_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('HubSpot OAuth credentials not configured');
    }

    try {
      const response = await firstValueFrom(this.httpService.post(
        'https://api.hubapi.com/oauth/v1/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      ));

      return response.data;
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to exchange HubSpot token: ${error.message}`,
      );
    }
  }

  async exchangeToken(provider: OAuthProvider, code: string, redirectUri: string) {
    switch (provider) {
      case OAuthProvider.HUBSPOT:
        return this.exchangeHubspotToken(code, redirectUri);
      default:
        throw new BadRequestException(`Unsupported provider: ${provider}`);
    }
  }
} 