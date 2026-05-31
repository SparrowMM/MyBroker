import type { MetadataRoute } from "next";

const description =
  "个人工作记忆与 AI 经纪人：记录、优先级、日终复盘。";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyBroker",
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
