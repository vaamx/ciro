import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { ServicesModule } from '../../services.module';

/**
 * WorkspaceModule provides access to workspace management functionality.
 * The WorkspaceService is provided by the ServicesModule.
 */
@Module({
  imports: [
    ServicesModule, // Import ServicesModule which provides the WorkspaceService
  ],
  controllers: [WorkspaceController],
  // No providers needed as WorkspaceService comes from ServicesModule
})
export class WorkspaceModule {} 