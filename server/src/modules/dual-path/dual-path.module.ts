import { Module, forwardRef, Provider } from '@nestjs/common';
import { DualPathController } from './dual-path.controller';
import { ServicesModule } from '../../services.module';
import { DualPathService } from './dual-path.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { QueryRouterService } from '../../services/code-execution/query-router.service';
import { CodeExecutionService } from '../../services/code-execution/code-execution.service';
import { RagIntegrationService } from '../../services/rag/integration.service';

// Create a separate DualPath-specific instance of the same service
const dualPathProviders: Provider[] = [
  {
    provide: 'DualPathQueryRouterService',
    useFactory: (originalService: QueryRouterService) => {
      return originalService;
    },
    inject: [{ token: QueryRouterService, optional: true }]
  },
  {
    provide: 'DualPathCodeExecutionService',
    useFactory: (originalService: CodeExecutionService) => {
      return originalService;
    },
    inject: [{ token: CodeExecutionService, optional: true }]
  },
  {
    provide: 'DualPathRagIntegrationService',
    useFactory: (originalService: RagIntegrationService) => {
      return originalService;
    },
    inject: [{ token: RagIntegrationService, optional: true }]
  },
];

@Module({
  imports: [
    // Import PrismaModule first since it doesn't have circular dependencies
    PrismaModule,
    
    // Use forwardRef to resolve circular dependency with ServicesModule
    forwardRef(() => ServicesModule),
  ],
  controllers: [DualPathController],
  providers: [
    DualPathService,
    ...dualPathProviders
  ],
  exports: [
    DualPathService,
  ]
})
export class DualPathModule {} 