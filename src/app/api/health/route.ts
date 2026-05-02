import { NextResponse } from "next/server";

/** 负载均衡 / 探活（不做数据库探测，避免探针放大 DB 压力） */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "MyBroker",
    time: new Date().toISOString(),
  });
}
