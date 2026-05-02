import { PrismaClient } from "@prisma/client";
import {
  isPlaceholderDatabaseUrl,
  withPgbouncerParamForPooler,
} from "@/lib/database-connection-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPlaceholderWarned?: boolean;
};

if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
}

if (
  process.env.NODE_ENV !== "production" &&
  isPlaceholderDatabaseUrl(process.env.DATABASE_URL) &&
  !globalForPrisma.prismaPlaceholderWarned
) {
  globalForPrisma.prismaPlaceholderWarned = true;
  console.warn(
    "[prisma] DATABASE_URL 仍是占位符（postgres.xxxxx / [YOUR_PASSWORD]），所有数据库操作都会失败。请先在 .env.local 中替换为真实 Supabase 凭据。",
  );
}

const resolvedDatabaseUrl = withPgbouncerParamForPooler(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(resolvedDatabaseUrl !== undefined
      ? { datasources: { db: { url: resolvedDatabaseUrl } } }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
