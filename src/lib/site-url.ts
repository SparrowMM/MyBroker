/** 站点绝对 origin（无尾部斜杠），用于 `metadataBase`、OG 等；不设时使用本地默认端口。 */
export function getSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://127.0.0.1:3000";
}
