import { Module, forwardRef } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import { AuthModule } from '../../core/auth/auth.module';
import { ServicesModule } from '../../services.module';
import { HubSpotService } from '../../services/datasources/connectors/hubspot/HubSpotService';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    // Import AuthModule to make JwtAuthGuard available
    AuthModule,
    forwardRef(() => ServicesModule),
    ConfigModule, // Import ConfigModule to make ConfigService available
  ],
  controllers: [OAuthController],
  providers: [
    // Use factory pattern to ensure proper initialization with ConfigService
    {
      provide: HubSpotService,
      useFactory: (configService: ConfigService) => {
        return new HubSpotService(configService);
      },
      inject: [ConfigService], // Explicitly tell NestJS to inject ConfigService
    }
  ],
  exports: [HubSpotService]
})
export class OAuthModule {} 