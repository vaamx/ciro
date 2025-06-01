import { Module, Logger, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// Import core modules directly
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from './core/database/prisma.module';
import { RedisHealthIndicator } from './common/health/redis.health';
import { AuthModule } from './core/auth/auth.module'; // Add direct import for AuthModule

// Environment flags
const IS_REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
const IS_BULL_DISABLED = process.env.NO_BULL === 'true';
const ENABLE_MODULE_GROUPING = process.env.ENABLE_MODULE_GROUPING === 'true';
const MODULE_GROUP = parseInt(process.env.MODULE_GROUP || '0', 10); // Default to group 0
const USE_FIXED_AUTH = process.env.USE_FIXED_AUTH === 'true'; // New env var for direct auth loading
const PROGRESSIVE_LOADING = process.env.PROGRESSIVE_LOADING === 'true'; // New env var for progressive loading

console.log('>>> CONFIG: REDIS_DISABLED =', IS_REDIS_DISABLED);
console.log('>>> CONFIG: NO_BULL =', IS_BULL_DISABLED);
console.log('>>> CONFIG: ENABLE_MODULE_GROUPING =', ENABLE_MODULE_GROUPING);
console.log('>>> CONFIG: MODULE_GROUP =', MODULE_GROUP);
console.log('>>> CONFIG: USE_FIXED_AUTH =', USE_FIXED_AUTH);
console.log('>>> CONFIG: PROGRESSIVE_LOADING =', PROGRESSIVE_LOADING);

// Only import bull conditionally
let BullModule;
if (!IS_BULL_DISABLED && !IS_REDIS_DISABLED) {
  // Dynamic import to avoid reference error when disabled
  BullModule = require('@nestjs/bull').BullModule;
}

// Define which modules should be excluded when REDIS_DISABLED is true
const REDIS_DEPENDENT_MODULES = (IS_REDIS_DISABLED || IS_BULL_DISABLED) ? [] : [
  BullModule.forRootAsync({
    useFactory: () => {
      console.log('>>> INFO: Initializing Bull Redis queues');
      return {
        redis: {
          // Use localhost since Docker Compose exposes Redis on localhost:6379
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          // IMPORTANT: Bull has specific constraints with Redis options
          // Disabling both problematic options per https://github.com/OptimalBits/bull/issues/1873
          maxRetriesPerRequest: null, // Must be null for Bull
          enableReadyCheck: false, // Must be false for Bull
          connectTimeout: 10000, // Increase to 10 seconds timeout
          enableOfflineQueue: true, // Enable offline queue
          autoResendUnfulfilledCommands: true, // Auto-resend commands
          retryStrategy: (times: number) => {
            console.log(`>>> Attempting Redis connection (attempt ${times})...`);
            // Retry more times with longer delays
            return Math.min(times * 500, 5000); // Max 5 second retry delay
          },
          reconnectOnError: (err: Error) => {
            console.log(`>>> Redis connection error: ${err.message}`);
            // If the error is likely recoverable, attempt reconnection
            const targetError = err.message.includes('READONLY') || 
                               err.message.includes('ETIMEDOUT') ||
                               err.message.includes('ECONNRESET');
            return targetError ? 1 : false; // 1 = reconnect immediately, false = don't reconnect
          }
        },
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: true,
          removeOnFail: true,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        },
        limiter: {
          max: 50,
          duration: 1000,
        },
      };
    },
  }),
  // Register the document-processing queue
  BullModule.registerQueue({
    name: 'document-processing',
  }),
];

// Define core modules that are always needed
const CORE_MODULES = [
  ConfigModule.forRoot({
    isGlobal: true,
  }),
  HttpModule,
  PrismaModule,
  ...(USE_FIXED_AUTH ? [AuthModule] : []), // Directly add fixed AuthModule if enabled
];

// Function to create fallback providers when Redis is disabled
function createFallbackProviders() {
  // Only create fallbacks if Redis or Bull is disabled
  if (process.env.REDIS_DISABLED !== 'true' && process.env.NO_BULL !== 'true') {
    return [];
  }

  return [
    // If you have any Redis-dependent services, add fallbacks here
    {
      provide: 'REDIS_CLIENT',
      useValue: {
        get: async () => null,
        set: async () => null,
        del: async () => null,
        exists: async () => false,
        // Add other methods as needed
      }
    },
    // Add mock Bull queue providers if needed
    {
      provide: 'BullQueue_document-processing',
      useValue: {
        add: async () => ({ id: `mock-${Date.now()}`, data: {} }),
        process: () => {}, 
        getJob: async () => null,
        // Other queue methods
      }
    }
  ];
}

// Helper function to dynamically import modules
async function importModule(path: string) {
  try {
    return await import(path);
  } catch (error: any) {
    console.error(`Failed to import module from path ${path}:`, error.message);
    return null;
  }
}

// Group modules for systematic testing
// Define a structured approach to organizing modules by functional area
enum ModuleArea {
  CORE = 'core',
  AUTH = 'auth',
  DATA = 'data',
  UI = 'ui',
  PROCESSING = 'processing',
  SEARCH = 'search',
  COMMUNICATIONS = 'communications',
  INTEGRATIONS = 'integrations'
}

// Organize modules by functional areas for systematic testing
const MODULE_AREAS = {
  [ModuleArea.CORE]: [],
  [ModuleArea.AUTH]: [
    './core/auth/auth.module'
  ],
  [ModuleArea.DATA]: [
    './modules/data-source/data-source.module',
    './services.module'
  ],
  [ModuleArea.UI]: [
    './modules/workspace/workspace.module',
    './modules/organization/organization.module',
    './modules/dashboard/dashboard.module',
    './modules/visualization/visualization.module'
  ],
  [ModuleArea.SEARCH]: [
    './modules/search/search.module',
    './modules/file/file.module'
  ],
  [ModuleArea.PROCESSING]: [
    './modules/document-processing/document-processing.module',
    './modules/dual-path/dual-path.module'
  ],
  [ModuleArea.COMMUNICATIONS]: [
    './modules/chat/chat.module'
  ],
  [ModuleArea.INTEGRATIONS]: [
    './modules/oauth/oauth.module',
    './modules/snowflake/snowflake.module'
  ]
};

// Function to get modules up to a specific area
function getModulesUpToArea(areaIndex: number): any[] {
  const areas = Object.values(ModuleArea);
  const modules = [];
  
  for (let i = 0; i <= Math.min(areaIndex, areas.length - 1); i++) {
    const area = areas[i];
    const modulePaths = MODULE_AREAS[area];
    
    for (const modulePath of modulePaths) {
      try {
        const importedModule = require(modulePath);
        // Get the module class name from the path (assuming it's the last part)
        const moduleName = modulePath.split('/').pop()?.replace('.module', '') || '';
        // Convert to PascalCase and add Module suffix if needed
        const className = moduleName
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('') + (moduleName.endsWith('Module') ? '' : 'Module');
        
        if (importedModule[className]) {
          modules.push(importedModule[className]);
          console.log(`>>> Added module: ${className}`);
        }
      } catch (error) {
        console.error(`Failed to import module ${modulePath}:`, error);
      }
    }
  }
  
  return modules;
}

// Get all modules for the classic module groups (for backward compatibility)
function getModulesByGroup(groupId: number) {
  if (!ENABLE_MODULE_GROUPING) {
    // Return all modules if grouping not enabled
    return getFullModuleSet();
  }

  console.log(`>>> LOADING MODULE GROUP ${groupId}`);
  
  // Define module groups for progressive diagnosis
  switch (groupId) {
    case 0:
      // Minimal set - just core functionality
      return [];
    case 1: 
      // Add auth module
      return [
        require('./core/auth/auth.module').AuthModule
      ];
    case 2:
      // Add data modules 
      return [
        require('./core/auth/auth.module').AuthModule,
        require('./modules/data-source/data-source.module').DataSourceModule,
        require('./services.module').ServicesModule,
      ];
    case 3:
      // Add UI modules
      return [
        require('./core/auth/auth.module').AuthModule,
        require('./modules/data-source/data-source.module').DataSourceModule,
        require('./services.module').ServicesModule,
        require('./modules/workspace/workspace.module').WorkspaceModule,
        require('./modules/organization/organization.module').OrganizationModule,
      ]; 
    case 4:
      // Add search and file modules
      return [
        require('./core/auth/auth.module').AuthModule,
        require('./modules/data-source/data-source.module').DataSourceModule,
        require('./services.module').ServicesModule,
        require('./modules/workspace/workspace.module').WorkspaceModule,
        require('./modules/organization/organization.module').OrganizationModule,
        require('./modules/search/search.module').SearchModule,
        require('./modules/file/file.module').FileModule,
      ];
    case 5:
      // Add processing modules
      return [
        require('./core/auth/auth.module').AuthModule,
        require('./modules/data-source/data-source.module').DataSourceModule,
        require('./services.module').ServicesModule,
        require('./modules/workspace/workspace.module').WorkspaceModule,
        require('./modules/organization/organization.module').OrganizationModule,
        require('./modules/search/search.module').SearchModule,
        require('./modules/file/file.module').FileModule,
        require('./modules/document-processing/document-processing.module').DocumentProcessingModule,
      ];
    case 99:
      // Test case: Only AuthModule + DataSourceModule (no ServicesModule)
      return [
        require('./core/auth/auth.module').AuthModule,
        require('./modules/data-source/data-source.module').DataSourceModule,
      ];
    case 98:
      // Test case: Only AuthModule + ServicesModule (no DataSourceModule)
      return [
        require('./core/auth/auth.module').AuthModule,
        require('./services.module').ServicesModule,
      ];
    case 97:
      // Test case: AuthModule + ServicesModule + DataSourceModule
      return [
        require('./core/auth/auth.module').AuthModule,
        require('./services.module').ServicesModule,
        require('./modules/data-source/data-source.module').DataSourceModule,
      ];
    case 96:
      // Test case: AuthModule + ServicesModule + DataSourceModule + SearchModule
      return [
        require('./core/auth/auth.module').AuthModule,
        require('./services.module').ServicesModule,
        require('./modules/data-source/data-source.module').DataSourceModule,
        require('./modules/search/search.module').SearchModule,
      ];
    case 95:
      // Test case: AuthModule + ServicesModule + DataSourceModule + SearchModule + WorkspaceModule
      return [
        require('./core/auth/auth.module').AuthModule,
        require('./services.module').ServicesModule,
        require('./modules/data-source/data-source.module').DataSourceModule,
        require('./modules/search/search.module').SearchModule,
        require('./modules/workspace/workspace.module').WorkspaceModule,
      ];
    default:
      return getFullModuleSet();
  }
}

// Return the full set of modules based on Redis availability
function getFullModuleSet() {
  // Prepare imports based on Redis/Bull availability
  const authModule = require('./core/auth/auth.module').AuthModule;
  const chatModule = require('./modules/chat/chat.module').ChatModule;
  const workspaceModule = require('./modules/workspace/workspace.module').WorkspaceModule;
  const organizationModule = require('./modules/organization/organization.module').OrganizationModule;
  const searchModule = require('./modules/search/search.module').SearchModule;
  const fileModule = require('./modules/file/file.module').FileModule;
  const dashboardModule = require('./modules/dashboard/dashboard.module').DashboardModule;
  const servicesModule = require('./services.module').ServicesModule;
  const dataSourceModule = require('./modules/data-source/data-source.module').DataSourceModule;
  const documentProcessingModule = require('./modules/document-processing/document-processing.module').DocumentProcessingModule;
  const visualizationModule = require('./modules/visualization/visualization.module').VisualizationModule;
  const dualPathModule = require('./modules/dual-path/dual-path.module').DualPathModule;
  const oauthModule = require('./modules/oauth/oauth.module').OAuthModule;
  const snowflakeModule = require('./modules/snowflake/snowflake.module').SnowflakeModule;
  const automationModule = require('./modules/automation/automation.module').AutomationModule;
  const codeExecutionModule = require('./services/code-execution/code-execution.module').CodeExecutionModule;
  
  const commonModules = [
    authModule,
    chatModule,
    workspaceModule,
    organizationModule,
    searchModule,
    fileModule,
    dashboardModule,
    servicesModule,
    dataSourceModule,
    documentProcessingModule,
    visualizationModule,
    dualPathModule,
    oauthModule,
    snowflakeModule,
    automationModule,
    codeExecutionModule,
  ];
  
  // Add Bull-dependent modules only if Bull is enabled
  if (!IS_BULL_DISABLED && !IS_REDIS_DISABLED) {
    const ingestionModule = require('./services/ingestion/ingestion.module').IngestionModule;
    const processorsModule = require('./services/datasources/processors/file/processors.module').ProcessorsModule;
    const jobsModule = require('./modules/jobs/jobs.module').JobsModule;
    
    return [
      ...commonModules,
      ingestionModule,
      processorsModule,
      jobsModule,
    ];
  }
  
  return commonModules;
}

// Determine which modules to load based on environment variables
function getModulesToLoad() {
  if (USE_FIXED_AUTH) {
    console.log('>>> Using fixed AuthModule only');
    return [];
  }
  
  if (PROGRESSIVE_LOADING) {
    // Load modules by functional area
    const areaIndex = parseInt(process.env.MODULE_AREA_INDEX || '0', 10);
    console.log(`>>> Progressive loading up to area index ${areaIndex}`);
    return getModulesUpToArea(areaIndex);
  }
  
  if (ENABLE_MODULE_GROUPING) {
    return getModulesByGroup(MODULE_GROUP);
  }
  
  return getFullModuleSet();
}

@Module({
  imports: [
    ...CORE_MODULES,
    ...REDIS_DEPENDENT_MODULES,
    ...getModulesToLoad(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    Logger,
    ...createFallbackProviders(),
    RedisHealthIndicator,
    {
      provide: 'REDIS_HEALTH_INDICATOR',
      useExisting: RedisHealthIndicator,
    },
  ],
})
export class AppModule {
  constructor() {
    console.log('>>> APP MODULE: Constructor called');
    if (IS_REDIS_DISABLED || IS_BULL_DISABLED) {
      console.log('>>> APP MODULE: Running in Redis-disabled mode');
    }
    
    if (USE_FIXED_AUTH) {
      console.log('>>> APP MODULE: Running with directly imported fixed AuthModule');
    } else if (PROGRESSIVE_LOADING) {
      const areaIndex = parseInt(process.env.MODULE_AREA_INDEX || '0', 10);
      const areas = Object.values(ModuleArea);
      console.log(`>>> APP MODULE: Running with progressive loading up to ${areas[areaIndex]}`);
    } else if (ENABLE_MODULE_GROUPING) {
      console.log(`>>> APP MODULE: Running with module group ${MODULE_GROUP}`);
    } else {
      console.log('>>> APP MODULE: Running with full module set');
    }
  }
} 