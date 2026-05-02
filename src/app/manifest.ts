import type { MetadataRoute } from "next";

const description =
  "经纪人后台与私人助理：日报录入、分析洞察、周期报表与项目归类建议。";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyBroker 智能工作台",
    short_name: "MyBroker",
    description,
    start_url: "/",
    display: "standalone",
    background_color: "#f3f7ff",
    theme_color: "#1e3a8a",
    orientation: "portrait-primary",
    lang: "zh-CN",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png", purpose: "any" },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
