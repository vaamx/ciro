import { 
  Controller, 
  Post, 
  All, 
  Body,  
  Req, 
  UseGuards, 
  HttpCode, 
  HttpStatus, 
  BadRequestException,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { User } from '../../core/database/prisma-types';
import { ProxyRequestDto, ProxyResponseDto } from './dto/proxy-request.dto';
import { HubSpotService } from '../../services/datasources/connectors/hubspot/HubSpotService';

@Controller('api/proxy')
@UseGuards(JwtAuthGuard)
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  // Inject services
  constructor(
    // private readonly proxyService: ProxyService // Uncomment if ProxyService is needed
    private readonly hubspotService: HubSpotService // Inject HubSpotService
  ) {}

  @All('hubspot/*')
  async proxyHubspotRequest(
    @GetUser() user: User, 
    @Req() request: any,
    @Body() body: any
  ): Promise<ProxyResponseDto> {
    try {
      // Extract the path from the URL
      const path = request.url.replace('/api/proxy/hubspot/', '');
      
      this.logger.log(`Proxying request to HubSpot: ${path}`);
      
      // Use the injected HubSpot service
      // const hubspotService = new HubSpotService(); // Remove manual instantiation
      
      // TODO: Implement actual proxy logic using this.hubspotService
      // e.g., await this.hubspotService.makeApiCall(path, request.method, body, userCredentials?);
      
      // For now, we'll just return a mock response
      return {
        data: { success: true },
        status: HttpStatus.OK
      };
    } catch (error) {
      this.logger.error(`Error proxying request to HubSpot: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new InternalServerErrorException('Failed to proxy request to HubSpot');
    }
  }

  // Example of a more specific endpoint for a particular service
  @Post('hubspot/contact')
  @HttpCode(HttpStatus.OK)
  async createHubspotContact(
    @GetUser() user: User,
    @Body() proxyRequest: ProxyRequestDto
  ): Promise<ProxyResponseDto> {
    try {
      if (!proxyRequest.payload) {
        throw new BadRequestException('Payload is required for contact creation');
      }
      
      // Use the injected HubSpot service
      // const hubspotService = new HubSpotService(); // Remove manual instantiation
      
      // TODO: Implement actual contact creation using this.hubspotService
      // e.g., const result = await this.hubspotService.createContact(proxyRequest.payload);
      
      return {
        data: { success: true, contactId: '12345' },
        status: HttpStatus.CREATED
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error creating HubSpot contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new InternalServerErrorException('Failed to create contact in HubSpot');
    }
  }

  // Add additional provider-specific proxy endpoints as needed
  // Example: Salesforce, Google Drive, etc.
} 