import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServiceLogger } from '../../common/utils/logger-factory';
import Docker = require('dockerode');
import * as path from 'path';
import * as fs from 'fs/promises';
import axios from 'axios';

export interface SandboxExecutionResult {
  stdout: string;
  stderr: string;
  success: boolean;
  execution_time: number;
  files: Array<{
    name: string;
    type: string;
    size: number;
    path: string;
  }>;
  error?: string;
}

export interface SandboxFile {
  name: string;
  type: string;
  size: number;
  url: string;
  content?: Buffer;
}

interface ContainerInfo {
  container: Docker.Container;
  port: number;
  created: Date;
  lastUsed: Date;
}

@Injectable()
export class SandboxManagerService implements OnModuleDestroy {
  private readonly logger = createServiceLogger(SandboxManagerService.name);
  private readonly docker: Docker;
  private readonly containers: Map<string, ContainerInfo> = new Map();
  private readonly maxIdleTime: number;
  private readonly maxContainers: number;
  private readonly basePort: number;
  private portCounter: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    this.docker = new Docker();
    this.maxIdleTime = parseInt(this.configService.get<string>('SANDBOX_MAX_IDLE_TIME') || '1800000'); // 30 minutes
    this.maxContainers = parseInt(this.configService.get<string>('SANDBOX_MAX_CONTAINERS') || '10');
    this.basePort = parseInt(this.configService.get<string>('SANDBOX_BASE_PORT') || '9000');
    this.portCounter = this.basePort;

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleContainers();
    }, 300000); // Check every 5 minutes

    this.logger.info('SandboxManagerService initialized', {
      maxIdleTime: this.maxIdleTime,
      maxContainers: this.maxContainers,
      basePort: this.basePort,
    });
  }

  async onModuleDestroy() {
    // Cleanup all containers on shutdown
    this.logger.info('Shutting down SandboxManagerService');
    clearInterval(this.cleanupInterval);
    
    const shutdownPromises = Array.from(this.containers.keys()).map(sessionId =>
      this.shutdownSandbox(sessionId)
    );
    
    await Promise.allSettled(shutdownPromises);
  }

  /**
   * Create a new sandbox container for a session
   */
  async createSandbox(sessionId: string): Promise<void> {
    if (this.containers.has(sessionId)) {
      this.logger.debug(`Sandbox already exists for session: ${sessionId}`);
      return;
    }

    // Check container limit
    if (this.containers.size >= this.maxContainers) {
      await this.cleanupOldestContainer();
    }

    const port = this.getNextPort();
    const scratchPath = path.join(process.cwd(), 'sandbox-data', sessionId);
    
    try {
      // Ensure scratch directory exists
      await fs.mkdir(scratchPath, { recursive: true });

      // Create container
      const container = await this.docker.createContainer({
        Image: 'ciro-sandbox:latest',
        name: `ciro-sandbox-${sessionId}`,
        ExposedPorts: { '8000/tcp': {} },
        HostConfig: {
          PortBindings: {
            '8000/tcp': [{ HostPort: port.toString() }]
          },
          Binds: [`${scratchPath}:/scratch`],
          Memory: 1024 * 1024 * 1024, // 1GB
          CpuQuota: 50000, // 50% of one CPU
          NetworkMode: 'none', // No network access for security
          CapDrop: ['ALL'], // Drop all capabilities
          ReadonlyRootfs: false, // Allow writes to /tmp and /scratch
          Tmpfs: {
            '/tmp': 'noexec,nosuid,size=100m'
          }
        },
        Env: [
          `SESSION_ID=${sessionId}`
        ]
      });

      await container.start();

      // Wait for container to be ready
      await this.waitForContainerReady(port);

      this.containers.set(sessionId, {
        container,
        port,
        created: new Date(),
        lastUsed: new Date()
      });

      this.logger.info(`Created sandbox for session: ${sessionId} on port ${port}`);
    } catch (error) {
      this.logger.error(`Failed to create sandbox for session: ${sessionId}`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create sandbox: ${errorMessage}`);
    }
  }

  /**
   * Execute code in a sandbox
   */
  async executeCode(sessionId: string, code: string): Promise<SandboxExecutionResult> {
    let containerInfo = this.containers.get(sessionId);
    
    if (!containerInfo) {
      await this.createSandbox(sessionId);
      containerInfo = this.containers.get(sessionId);
    }

    if (!containerInfo) {
      throw new Error(`Failed to create or find sandbox for session: ${sessionId}`);
    }

    // Update last used time
    containerInfo.lastUsed = new Date();

    try {
      const response = await axios.post(`http://localhost:${containerInfo.port}/execute`, {
        code,
        timeout: 30
      }, {
        timeout: 35000, // Slightly longer than execution timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.logger.debug(`Code executed in sandbox ${sessionId}`, {
        success: response.data.success,
        executionTime: response.data.execution_time
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to execute code in sandbox ${sessionId}`, error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          // Container might be down, try to recreate
          await this.shutdownSandbox(sessionId);
          throw new Error('Sandbox container is not responding. Please try again.');
        }
        
        throw new Error(`Sandbox execution error: ${error.message}`);
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to execute code: ${errorMessage}`);
    }
  }

  /**
   * Get files from sandbox
   */
  async getFiles(sessionId: string): Promise<SandboxFile[]> {
    const containerInfo = this.containers.get(sessionId);
    
    if (!containerInfo) {
      return [];
    }

    try {
      const response = await axios.get(`http://localhost:${containerInfo.port}/files`);
      const files = response.data.files || [];
      
      // Convert to our format and add URLs
      return files.map((file: any) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        url: `/api/sandbox/${sessionId}/files/${file.name}`
      }));
    } catch (error) {
      this.logger.error(`Failed to get files from sandbox ${sessionId}`, error);
      return [];
    }
  }

  /**
   * Get a specific file from sandbox
   */
  async getFile(sessionId: string, filename: string): Promise<Buffer | null> {
    const scratchPath = path.join(process.cwd(), 'sandbox-data', sessionId, filename);
    
    try {
      const content = await fs.readFile(scratchPath);
      return content;
    } catch (error) {
      this.logger.error(`Failed to read file ${filename} from sandbox ${sessionId}`, error);
      return null;
    }
  }

  /**
   * Shutdown a sandbox container
   */
  async shutdownSandbox(sessionId: string): Promise<void> {
    const containerInfo = this.containers.get(sessionId);
    
    if (!containerInfo) {
      return;
    }

    try {
      await containerInfo.container.stop({ t: 10 }); // Grace period of 10 seconds
      await containerInfo.container.remove();
      this.containers.delete(sessionId);
      
      this.logger.info(`Shut down sandbox for session: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to shutdown sandbox for session: ${sessionId}`, error);
      // Still remove from our tracking
      this.containers.delete(sessionId);
    }

    // Clean up scratch directory
    try {
      const scratchPath = path.join(process.cwd(), 'sandbox-data', sessionId);
      await fs.rm(scratchPath, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(`Failed to clean up scratch directory for session: ${sessionId}`, error);
    }
  }

  /**
   * Get sandbox status
   */
  async getSandboxStatus(sessionId: string): Promise<any> {
    const containerInfo = this.containers.get(sessionId);
    
    if (!containerInfo) {
      return { exists: false };
    }

    try {
      const response = await axios.get(`http://localhost:${containerInfo.port}/status`);
      return {
        exists: true,
        created: containerInfo.created,
        lastUsed: containerInfo.lastUsed,
        port: containerInfo.port,
        ...response.data
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        exists: true,
        created: containerInfo.created,
        lastUsed: containerInfo.lastUsed,
        port: containerInfo.port,
        status: 'error',
        error: errorMessage
      };
    }
  }

  /**
   * List all active sandboxes
   */
  listSandboxes(): Array<{ sessionId: string; created: Date; lastUsed: Date; port: number }> {
    const result: Array<{ sessionId: string; created: Date; lastUsed: Date; port: number }> = [];
    
    this.containers.forEach((info, sessionId) => {
      result.push({
        sessionId,
        created: info.created,
        lastUsed: info.lastUsed,
        port: info.port
      });
    });
    
    return result;
  }

  private getNextPort(): number {
    return this.portCounter++;
  }

  private async waitForContainerReady(port: number, maxRetries: number = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await axios.get(`http://localhost:${port}/healthz`, { timeout: 1000 });
        return; // Container is ready
      } catch (error) {
        // Wait 1 second before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error(`Container failed to become ready on port ${port}`);
  }

  private async cleanupIdleContainers(): Promise<void> {
    const now = new Date();
    const sessionsToCleanup: string[] = [];

    this.containers.forEach((info, sessionId) => {
      if (now.getTime() - info.lastUsed.getTime() > this.maxIdleTime) {
        sessionsToCleanup.push(sessionId);
      }
    });

    if (sessionsToCleanup.length > 0) {
      this.logger.info(`Cleaning up ${sessionsToCleanup.length} idle containers`);
      
      const cleanupPromises = sessionsToCleanup.map(sessionId =>
        this.shutdownSandbox(sessionId)
      );
      
      await Promise.allSettled(cleanupPromises);
    }
  }

  private async cleanupOldestContainer(): Promise<void> {
    if (this.containers.size === 0) {
      return;
    }

    // Find the oldest container by creation time
    let oldestSessionId: string | null = null;
    let oldestTime: Date | null = null;

    this.containers.forEach((info, sessionId) => {
      if (!oldestTime || info.created < oldestTime) {
        oldestTime = info.created;
        oldestSessionId = sessionId;
      }
    });

    if (oldestSessionId) {
      this.logger.info(`Cleaning up oldest container: ${oldestSessionId}`);
      await this.shutdownSandbox(oldestSessionId);
    }
  }
} 