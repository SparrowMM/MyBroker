import { describe, expect, it } from "vitest";
import { withPgbouncerParamForPooler } from "./database-connection-url";

describe("withPgbouncerParamForPooler", () => {
  it("空或未定义原样返回 undefined", () => {
    expect(withPgbouncerParamForPooler(undefined)).toBeUndefined();
    expect(withPgbouncerParamForPooler("")).toBeUndefined();
  });

  it("非 Supabase pooler 主机不改动", () => {
    const u = "postgresql://u:p@localhost:5432/db";
    expect(withPgbouncerParamForPooler(u)).toBe(u);
  });

  it("pooler 主机且无 pgbouncer 时追加参数", () => {
    expect(
      withPgbouncerParamForPooler(
        "postgresql://u:p@aws-0-ap.pooler.supabase.com:6543/postgres",
      ),
    ).toBe(
      "postgresql://u:p@aws-0-ap.pooler.supabase.com:6543/postgres?pgbouncer=true",
    );
    expect(
      withPgbouncerParamForPooler(
        "postgresql://u:p@aws-0-ap.pooler.supabase.com:6543/postgres?sslmode=require",
      ),
    ).toBe(
      "postgresql://u:p@aws-0-ap.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true",
    );
  });

  it("已有 pgbouncer=true 时不重复追加", () => {
    const withParam =
      "postgresql://u:p@x.pooler.supabase.com:6543/postgres?pgbouncer=true";
    expect(withPgbouncerParamForPooler(withParam)).toBe(withParam);
    const mid =
      "postgresql://u:p@x.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=10";
    expect(withPgbouncerParamForPooler(mid)).toBe(mid);
  });
});
