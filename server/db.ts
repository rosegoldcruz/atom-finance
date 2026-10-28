import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://atom:atom@127.0.0.1:5432/atom';
}

export const prisma = new PrismaClient();
