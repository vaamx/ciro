import { Injectable, OnModuleInit, OnModuleDestroy, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    console.log('>>> PRISMA_SERVICE: Constructor starting...');
    super(); // Call the PrismaClient constructor
    console.log('>>> PRISMA_SERVICE: Constructor finished (super called).');
  }

  async onModuleInit() {
    console.log('>>> PRISMA_SERVICE: Entering onModuleInit...');
    // Connect to the database when the module is initialized.
    console.log('>>> PRISMA_SERVICE: Attempting this.$connect()...');
    try {
      await this.$connect();
      console.log('>>> PRISMA_SERVICE: Database connection successful.');
    } catch (error) {
      console.error('>>> PRISMA_SERVICE: Failed to connect to the database.', error);
      // Optional: re-throw or exit if connection is critical
      // throw error; 
      // process.exit(1);
    }
  }

  async onModuleDestroy() {
    // Disconnect from the database when the application shuts down.
    await this.$disconnect();
  }

  // Optional: Add graceful shutdown hook for NestJS app
  // See: https://docs.nestjs.com/recipes/prisma#issues-with-enableshutdownhooks
  // async enableShutdownHooks(app: INestApplication) {
  //   process.on('beforeExit', async () => {
  //     await app.close();
  //   });
  // }
} 