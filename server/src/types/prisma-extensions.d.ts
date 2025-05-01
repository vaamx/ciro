import { PrismaClient } from '@prisma/client';

declare module '@core/database/prisma.service' {
  interface PrismaService extends PrismaClient {
    // We need to explicitly add the models here to make TypeScript happy
    // This is because PrismaService extends PrismaClient but TypeScript
    // doesn't recognize the dynamically generated properties
    dataSource: PrismaClient['dataSource'];
    processingJob: PrismaClient['processingJob'];
    documentChunk: PrismaClient['documentChunk'];
  }
} 