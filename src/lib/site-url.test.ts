import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSiteOrigin } from "./site-url";

describe("getSiteOrigin", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("优先使用 NEXT_PUBLIC_APP_URL 并去掉尾部斜杠", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example/");
    expect(getSiteOrigin()).toBe("https://app.example");
  });

  it("未设公开 URL 时使用 VERCEL_URL 并加 https", () => {
    vi.stubEnv("VERCEL_URL", "my-app.vercel.app");
    expect(getSiteOrigin()).toBe("https://my-app.vercel.app");
  });

  it("否则回退到本地默认", () => {
    expect(getSiteOrigin()).toBe("http://127.0.0.1:3000");
  });

  it("NEXT_PUBLIC_APP_URL 仅空白时走后续逻辑", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "  ");
    vi.stubEnv("VERCEL_URL", "x.vercel.app");
    expect(getSiteOrigin()).toBe("https://x.vercel.app");
  });
});
