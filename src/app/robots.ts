import type { MetadataRoute } from "next";

/** 默认整站不索引（后台/工作台场景）。若需公开落地页，改为 allow 或拆分域名。 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/"],
      },
    ],
  };
}
