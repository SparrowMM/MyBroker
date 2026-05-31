/**
 * Supabase pooler（*.pooler.supabase.com）在事务模式下无法跨连接复用预处理语句，
 * Prisma 需 `pgbouncer=true`，否则会间歇性报错：prepared statement "sN" does not exist。
 * @see https://www.prisma.io/docs/orm/overview/databases/postgresql#using-pgbouncer
 */
export function withPgbouncerParamForPooler(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (!/pooler\.supabase\.com/i.test(url)) return url;
  if (/[?&]pgbouncer=true(?:&|$)/i.test(url)) return url;
  return url.includes("?") ? `${url}&pgbouncer=true` : `${url}?pgbouncer=true`;
}

/**
 * 检查 DATABASE_URL 是否仍是 .env.example 中的占位符（如 `xxxxx` / `[YOUR_PASSWORD]`）。
 * 仅做明显占位符的字面识别，不试图校验真实凭据有效性。
 */
export function isPlaceholderDatabaseUrl(url: string | undefined): boolean {
  if (!url) return true;
  if (/postgres\.xxxxx/i.test(url)) return true;
  if (/\[YOUR_PASSWORD\]/i.test(url)) return true;
  if (/your[_-]?password/i.test(url)) return true;
  return false;
}

/** 友好提示文案：当数据库未配置或仍为占位符时给前端展示。 */
export const DATABASE_NOT_CONFIGURED_MESSAGE =
  "数据库未配置：请在 .env.local 中将 DATABASE_URL 替换为真实的 Supabase 连接串（把 postgres.xxxxx 改成项目 Reference ID，把 [YOUR_PASSWORD] 改成数据库密码），然后重启 dev server。";
