import { PrismaClient } from "@prisma/client";
import { withPgbouncerParamForPooler } from "@/lib/database-connection-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
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
