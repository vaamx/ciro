import * as fs from 'fs';

// Configure script options
const DRY_RUN = false; // Set to true to not actually modify files
const APP_FILE_PATH = 'src/app.ts';
const INDEX_FILE_PATH = 'src/index.ts';

console.log('🔍 Registering services in Express app...');

// Check if services module exists
if (!fs.existsSync('src/services.module.ts')) {
  console.error('❌ Services module not found at src/services.module.ts');
  process.exit(1);
}

// First, let's update the app.ts file
if (fs.existsSync(APP_FILE_PATH)) {
  const appContent = fs.readFileSync(APP_FILE_PATH, 'utf-8');
  
  // Create a new import for the ServiceRegistry
  let modifiedAppContent = appContent;
  
  // Check if the ServiceRegistry is already imported
  const alreadyImported = modifiedAppContent.includes('ServiceRegistry');
  
  if (!alreadyImported) {
    // Add import for ServiceRegistry
    const importStatement = "import { ServiceRegistry } from './services/core/service-registry';\n";
    
    // Find the last import and add after it
    const lastImportIndex = modifiedAppContent.lastIndexOf('import ');
    const lastImportEnd = modifiedAppContent.indexOf(';', lastImportIndex) + 1;
    
    modifiedAppContent = 
      modifiedAppContent.substring(0, lastImportEnd) + 
      '\n' + importStatement +
      modifiedAppContent.substring(lastImportEnd);
    
    // Add ServiceRegistry initialization before routes
    const routesStartPattern = '// Routes';
    const routesStartIndex = modifiedAppContent.indexOf(routesStartPattern);
    
    if (routesStartIndex !== -1) {
      const serviceRegistryInit = `
// Initialize dependency injection
ServiceRegistry.initializeServices();

`;
      
      modifiedAppContent = 
        modifiedAppContent.substring(0, routesStartIndex) +
        serviceRegistryInit +
        modifiedAppContent.substring(routesStartIndex);
    }
    
    // Save the modified app.ts
    if (!DRY_RUN) {
      // Create backup
      fs.writeFileSync(`${APP_FILE_PATH}.bak`, appContent);
      
      // Write modified app.ts
      fs.writeFileSync(APP_FILE_PATH, modifiedAppContent);
      console.log(`✅ Updated ${APP_FILE_PATH} to use ServiceRegistry`);
    } else {
      console.log(`🔄 Would update ${APP_FILE_PATH} (dry run)`);
    }
  } else {
    console.log(`ℹ️ ServiceRegistry is already imported in ${APP_FILE_PATH}`);
  }
} else {
  console.warn(`⚠️ ${APP_FILE_PATH} not found. Skipping app file update.`);
}

// Next, let's update the index.ts file to use dependency injection instead of getInstance
if (fs.existsSync(INDEX_FILE_PATH)) {
  const indexContent = fs.readFileSync(INDEX_FILE_PATH, 'utf-8');
  
  // Replace the direct getInstance call with ServiceRegistry
  let modifiedIndexContent = indexContent;
  
  // Check for SocketService.getInstance() pattern
  if (modifiedIndexContent.includes('SocketService.getInstance(')) {
    // Replace with ServiceRegistry
    modifiedIndexContent = modifiedIndexContent.replace(
      /SocketService\.getInstance\(server\);/,
      'const socketService = ServiceRegistry.resolve(SocketService);\nsocketService.initialize(server);'
    );
    
    // Add import for ServiceRegistry if not already there
    if (!modifiedIndexContent.includes('ServiceRegistry')) {
      const importStatement = "import { ServiceRegistry } from './services/core/service-registry';\n";
      
      // Find the last import and add after it
      const lastImportIndex = modifiedIndexContent.lastIndexOf('import ');
      const lastImportEnd = modifiedIndexContent.indexOf(';', lastImportIndex) + 1;
      
      modifiedIndexContent = 
        modifiedIndexContent.substring(0, lastImportEnd) + 
        '\n' + importStatement +
        modifiedIndexContent.substring(lastImportEnd);
    }
    
    // Save the modified index.ts
    if (!DRY_RUN) {
      // Create backup
      fs.writeFileSync(`${INDEX_FILE_PATH}.bak`, indexContent);
      
      // Write modified index.ts
      fs.writeFileSync(INDEX_FILE_PATH, modifiedIndexContent);
      console.log(`✅ Updated ${INDEX_FILE_PATH} to use ServiceRegistry`);
    } else {
      console.log(`🔄 Would update ${INDEX_FILE_PATH} (dry run)`);
    }
  } else {
    console.log(`ℹ️ No getInstance calls found in ${INDEX_FILE_PATH} or already updated`);
  }
} else {
  console.warn(`⚠️ ${INDEX_FILE_PATH} not found. Skipping index file update.`);
}

// Now create a ServiceRegistry if it doesn't exist yet
const SERVICE_REGISTRY_PATH = 'src/services/core/service-registry.ts';

// Check if we need to update the service registry
if (fs.existsSync(SERVICE_REGISTRY_PATH)) {
  const registryContent = fs.readFileSync(SERVICE_REGISTRY_PATH, 'utf-8');
  
  // Check if already updated for dependency injection
  if (registryContent.includes('initializeServices()') && registryContent.includes('@Injectable()')) {
    console.log(`ℹ️ ServiceRegistry already set up for dependency injection`);
  } else {
    // Update the ServiceRegistry to support dependency injection
    let modifiedRegistryContent = `import { Injectable } from '@nestjs/common';
import { ServicesModule } from '../../services.module';

/**
 * ServiceRegistry for managing dependency injection
 * This replaces the manual singleton patterns with proper DI
 */
@Injectable()
export class ServiceRegistry {
  private static container = new Map<any, any>();
  private static initialized = false;

  /**
   * Initialize all services from the ServicesModule
   */
  public static initializeServices(): void {
    if (ServiceRegistry.initialized) {
      return;
    }

    console.log('Initializing ServiceRegistry with dependency injection');
    
    // Import all services that were converted from singletons
    const moduleContent = require('../../services.module');
    const servicesModule = moduleContent.ServicesModule;
    
    // Get providers from module
    if (servicesModule && servicesModule.providers) {
      for (const provider of servicesModule.providers) {
        try {
          // Create instance of service
          const instance = new provider();
          
          // Register in container
          ServiceRegistry.container.set(provider, instance);
          console.log(\`Registered service: \${provider.name}\`);
        } catch (error) {
          console.error(\`Error initializing service \${provider.name}:\`, error);
        }
      }
    }
    
    ServiceRegistry.initialized = true;
  }

  /**
   * Resolve a service by its class
   * @param serviceClass The class of the service to resolve
   * @returns The service instance
   */
  public static resolve<T>(serviceClass: new (...args: any[]) => T): T {
    if (!ServiceRegistry.initialized) {
      ServiceRegistry.initializeServices();
    }
    
    // Get from container
    const instance = ServiceRegistry.container.get(serviceClass);
    
    if (!instance) {
      // Try to create on demand if not found
      try {
        const newInstance = new serviceClass();
        ServiceRegistry.container.set(serviceClass, newInstance);
        return newInstance;
      } catch (error) {
        console.error(\`Failed to create service \${serviceClass.name}:\`, error);
        throw new Error(\`Service \${serviceClass.name} not found in registry and could not be created\`);
      }
    }
    
    return instance;
  }

  /**
   * Register a service instance
   * @param serviceClass The service class
   * @param instance The service instance
   */
  public static register<T>(serviceClass: new (...args: any[]) => T, instance: T): void {
    ServiceRegistry.container.set(serviceClass, instance);
  }
}`;

    // Save the modified service registry
    if (!DRY_RUN) {
      // Create backup
      fs.writeFileSync(`${SERVICE_REGISTRY_PATH}.bak`, registryContent);
      
      // Write modified service registry
      fs.writeFileSync(SERVICE_REGISTRY_PATH, modifiedRegistryContent);
      console.log(`✅ Updated ServiceRegistry for dependency injection`);
    } else {
      console.log(`🔄 Would update ServiceRegistry (dry run)`);
    }
  }
} else {
  console.error(`❌ ServiceRegistry not found at ${SERVICE_REGISTRY_PATH}`);
  console.log('Creating a new ServiceRegistry...');
  
  // Create directories if they don't exist
  const dir = SERVICE_REGISTRY_PATH.substring(0, SERVICE_REGISTRY_PATH.lastIndexOf('/'));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Create a new ServiceRegistry
  const newRegistryContent = `import { Injectable } from '@nestjs/common';
import { ServicesModule } from '../../services.module';

/**
 * ServiceRegistry for managing dependency injection
 * This replaces the manual singleton patterns with proper DI
 */
@Injectable()
export class ServiceRegistry {
  private static container = new Map<any, any>();
  private static initialized = false;

  /**
   * Initialize all services from the ServicesModule
   */
  public static initializeServices(): void {
    if (ServiceRegistry.initialized) {
      return;
    }

    console.log('Initializing ServiceRegistry with dependency injection');
    
    // Import all services that were converted from singletons
    const moduleContent = require('../../services.module');
    const servicesModule = moduleContent.ServicesModule;
    
    // Get providers from module
    if (servicesModule && servicesModule.providers) {
      for (const provider of servicesModule.providers) {
        try {
          // Create instance of service
          const instance = new provider();
          
          // Register in container
          ServiceRegistry.container.set(provider, instance);
          console.log(\`Registered service: \${provider.name}\`);
        } catch (error) {
          console.error(\`Error initializing service \${provider.name}:\`, error);
        }
      }
    }
    
    ServiceRegistry.initialized = true;
  }

  /**
   * Resolve a service by its class
   * @param serviceClass The class of the service to resolve
   * @returns The service instance
   */
  public static resolve<T>(serviceClass: new (...args: any[]) => T): T {
    if (!ServiceRegistry.initialized) {
      ServiceRegistry.initializeServices();
    }
    
    // Get from container
    const instance = ServiceRegistry.container.get(serviceClass);
    
    if (!instance) {
      // Try to create on demand if not found
      try {
        const newInstance = new serviceClass();
        ServiceRegistry.container.set(serviceClass, newInstance);
        return newInstance;
      } catch (error) {
        console.error(\`Failed to create service \${serviceClass.name}:\`, error);
        throw new Error(\`Service \${serviceClass.name} not found in registry and could not be created\`);
      }
    }
    
    return instance;
  }

  /**
   * Register a service instance
   * @param serviceClass The service class
   * @param instance The service instance
   */
  public static register<T>(serviceClass: new (...args: any[]) => T, instance: T): void {
    ServiceRegistry.container.set(serviceClass, instance);
  }
}`;

  // Save the new service registry
  if (!DRY_RUN) {
    fs.writeFileSync(SERVICE_REGISTRY_PATH, newRegistryContent);
    console.log(`✅ Created new ServiceRegistry at ${SERVICE_REGISTRY_PATH}`);
  } else {
    console.log(`🔄 Would create new ServiceRegistry at ${SERVICE_REGISTRY_PATH} (dry run)`);
  }
}

// Update SocketService to support initialization
const SOCKET_SERVICE_PATH = 'src/services/util/socket.service.ts';

if (fs.existsSync(SOCKET_SERVICE_PATH)) {
  const socketServiceContent = fs.readFileSync(SOCKET_SERVICE_PATH, 'utf-8');
  
  // Check if it already has an initialize method
  if (socketServiceContent.includes('initialize(server')) {
    console.log(`ℹ️ SocketService already has initialize method`);
  } else {
    // Update the SocketService
    let modifiedSocketContent = socketServiceContent;
    
    // Add initialize method
    const lastMethodMatch = modifiedSocketContent.match(/(\s+)(public|private)\s+[a-zA-Z0-9_]+\s*\([^)]*\)(\s*:\s*[a-zA-Z<>]+)?\s*{[^}]*}/g);
    let insertPosition = modifiedSocketContent.length - 2; // Default near end of file
    
    if (lastMethodMatch && lastMethodMatch.length > 0) {
      const lastMethod = lastMethodMatch[lastMethodMatch.length - 1];
      insertPosition = modifiedSocketContent.lastIndexOf(lastMethod) + lastMethod.length;
    }
    
    const initializeMethod = `
  /**
   * Initialize the socket service with a server instance
   * @param server HTTP server instance
   */
  public initialize(server: any): void {
    // Initialize socketIo with server
    this.io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    
    this.setupSocketHandlers();
    console.log('Socket.IO initialized');
  }
`;
    
    modifiedSocketContent = 
      modifiedSocketContent.substring(0, insertPosition) +
      initializeMethod +
      modifiedSocketContent.substring(insertPosition);
    
    // Update constructor to remove server parameter
    if (modifiedSocketContent.includes('constructor(server')) {
      modifiedSocketContent = modifiedSocketContent.replace(
        /constructor\(server: any\) {[\s\S]*?}/,
        `constructor() {
    // Server will be passed in initialize() method
  }`
      );
    }
    
    // Remove getInstance implementation
    if (modifiedSocketContent.includes('getInstance')) {
      // Just keep the modified constructor and initialize methods
      // The transformSingletons script should have already removed the getInstance method
    }
    
    // Save the modified socket service
    if (!DRY_RUN) {
      // Create backup
      fs.writeFileSync(`${SOCKET_SERVICE_PATH}.bak`, socketServiceContent);
      
      // Write modified socket service
      fs.writeFileSync(SOCKET_SERVICE_PATH, modifiedSocketContent);
      console.log(`✅ Updated SocketService with initialize method`);
    } else {
      console.log(`🔄 Would update SocketService (dry run)`);
    }
  }
} else {
  console.warn(`⚠️ SocketService not found at ${SOCKET_SERVICE_PATH}`);
}

console.log('\n✅ Express application updated to use dependency injection!');
console.log('\n⚠️ IMPORTANT: Review the changes made to ensure everything is correct.');
console.log('You might need to adjust some services manually, particularly those with special initialization needs.');

// Instructions for using the new ServiceRegistry
console.log('\n📝 To use services with the new dependency injection system:');
console.log('1. In Express routes: const service = ServiceRegistry.resolve(ServiceClass);');
console.log('2. In other services: Use constructor injection with @Injectable()');
console.log('3. For special initialization (like SocketService): Add initialize() methods');

// Instructions for completing the migration
console.log('\n🚀 Next steps to complete the migration:');
console.log('1. Run the application and check for any runtime errors');
console.log('2. Fix any dependency issues that arise');
console.log('3. Update any remaining getInstance() calls manually');
console.log('4. Remove any unused imports or code');
console.log('5. Delete backup (.bak) files once everything is working'); 