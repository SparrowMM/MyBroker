import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyCronSecret } from "./cron-auth";

function mockReq(opts: { authHeader?: string; querySecret?: string }): NextRequest {
  const u = new URL("https://example.com/api/cron/push-daily");
  if (opts.querySecret !== undefined) {
    u.searchParams.set("secret", opts.querySecret);
  }
  const headers = new Headers();
  if (opts.authHeader !== undefined) {
    headers.set("authorization", opts.authHeader);
  }
  return { headers, nextUrl: u } as NextRequest;
}

describe("verifyCronSecret", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("未配置 CRON_SECRET 时拒绝", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(verifyCronSecret(mockReq({}))).toEqual({
      ok: false,
      reason: "CRON_SECRET 未配置",
    });
  });

  it("Authorization Bearer 正确则通过", () => {
    expect(verifyCronSecret(mockReq({ authHeader: "Bearer cron-test-secret" }))).toEqual({
      ok: true,
      reason: "",
    });
  });

  it("query ?secret= 正确则通过", () => {
    expect(verifyCronSecret(mockReq({ querySecret: "cron-test-secret" }))).toEqual({
      ok: true,
      reason: "",
    });
  });

  it("密钥错误则未授权", () => {
    expect(verifyCronSecret(mockReq({ authHeader: "Bearer wrong" }))).toEqual({
      ok: false,
      reason: "未授权",
    });
  });
});
