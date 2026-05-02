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
