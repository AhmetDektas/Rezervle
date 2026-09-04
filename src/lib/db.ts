import { PrismaClient } from '@prisma/client';

// Next.js geliştirme modunda modüller yeniden yüklenir; tek istemciyi
// globalThis üzerinde tutmazsak bağlantı havuzu tükenir.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
