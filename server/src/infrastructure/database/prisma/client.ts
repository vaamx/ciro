/**
 * Prisma client singleton module
 * This provides a single instance of the Prisma client throughout the application
 */
import { PrismaClient } from '@prisma/client';

// We use a singleton pattern to avoid creating multiple instances of PrismaClient
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

// Use global object to maintain a single instance across hot reloads in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

// Create a new client or reuse existing one
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// In development, attach the client to the global object to prevent multiple instances during hot reloads
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Shutdown hook for graceful shutdown
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

export default prisma; 