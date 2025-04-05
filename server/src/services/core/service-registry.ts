import { Injectable } from '@nestjs/common';
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
          console.log(`Registered service: ${provider.name}`);
        } catch (error) {
          console.error(`Error initializing service ${provider.name}:`, error);
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
        console.error(`Failed to create service ${serviceClass.name}:`, error);
        throw new Error(`Service ${serviceClass.name} not found in registry and could not be created`);
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
}