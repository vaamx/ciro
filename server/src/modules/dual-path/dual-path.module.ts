import { Module, forwardRef, Provider, Inject } from '@nestjs/common';
import { DualPathController } from './dual-path.controller';
import { DualPathService } from './dual-path.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { LLMModule } from '../../services/llm/llm.module';
import { VectorModule } from '../../services/vector/vector.module';
import { QueryRouterService } from '../../services/code-execution/query-router.service';
import { CodeExecutionService } from '../../services/code-execution/code-execution.service';
import { RagIntegrationService } from '../../services/rag/integration.service';
import { ServicesModule } from '../../services.module';

// Create a separate DualPath-specific instance of the same service
const dualPathProviders: Provider[] = [
  {
    provide: 'DualPathQueryRouterService',
    useFactory: (originalService?: QueryRouterService) => {
      return originalService || null;
    },
    inject: [{ token: QueryRouterService, optional: true }]
  },
  {
    provide: 'DualPathCodeExecutionService', 
    useFactory: (originalService?: CodeExecutionService) => {
      return originalService || null;
    },
    inject: [{ token: CodeExecutionService, optional: true }]
  },
  {
    provide: 'DualPathRagIntegrationService',
    useFactory: (originalService?: RagIntegrationService) => {
      return originalService || null;
    },
    inject: [{ token: RagIntegrationService, optional: true }]
  }
];

@Module({
  imports: [
    // Import PrismaModule first since it doesn't have circular dependencies
    PrismaModule,
    
    // Import specific modules that provide the base functionality
    LLMModule,
    VectorModule,
    
    // Import ServicesModule with forwardRef to get access to the services we need
    forwardRef(() => ServicesModule),
  ],
  controllers: [DualPathController],
  providers: [
    DualPathService,
    // Don't provide the services directly, let the factories handle optional injection
    ...dualPathProviders
  ],
  exports: [
    DualPathService,
  ]
})
export class DualPathModule {} 