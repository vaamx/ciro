import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { QueryRouterService } from './services/code-execution/query-router.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly queryRouterService: QueryRouterService,
  ) {}

  // Basic endpoint to confirm controller is working
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('test-analytical')
  async testAnalyticalRAG(@Body() body: { query: string; sessionId?: string }) {
    const sessionId = body.sessionId || `test-${Date.now()}`;
    
    try {
      // First, test the routing decision
      const routingDecision = await this.queryRouterService.determineRoute(body.query);
      
      // If it's routed to analytical, execute it
      if (routingDecision.chosenPath === 'analytical_rag') {
        const result = await this.queryRouterService.executeAnalyticalQuery(
          sessionId,
          body.query
        );
        
        return {
          success: true,
          routingDecision,
          analyticalResult: result
        };
      } else {
        return {
          success: true,
          routingDecision,
          message: `Query was routed to: ${routingDecision.chosenPath}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 