import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DualPathService {
  private readonly logger = new Logger(DualPathService.name);

  constructor() {
    this.logger.log('DualPathService initialized');
  }

  /**
   * Placeholder service to help resolve circular dependencies
   * This service can be expanded with additional functionalities as needed
   */
  getServiceInfo(): { name: string; version: string } {
    return {
      name: 'DualPathService',
      version: '1.0.0'
    };
  }
} 