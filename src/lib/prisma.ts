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

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    ...(resolvedDatabaseUrl !== undefined
      ? { datasources: { db: { url: resolvedDatabaseUrl } } }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** schema 变更后 dev 热重载可能仍持有旧 Client（缺少新 model delegate） */
function isStaleDevClient(client: PrismaClient | undefined): boolean {
  if (!client || process.env.NODE_ENV === "production") return false;
  return typeof (client as PrismaClient & { dailyReview?: unknown }).dailyReview === "undefined";
}

let cached = globalForPrisma.prisma;
if (isStaleDevClient(cached)) {
  cached = undefined;
}

export const prisma = cached ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
