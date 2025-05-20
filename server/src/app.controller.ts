import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  // Basic endpoint to confirm controller is working
  @Get()
  getHello(): string {
    return 'Hello World!';
  }
} 