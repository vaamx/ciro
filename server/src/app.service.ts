import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // Basic method
  getHello(): string {
    return 'Hello World Service!';
  }
} 