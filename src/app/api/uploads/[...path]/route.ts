import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseStorageBucket,
  getSupabaseUrl,
} from "@/lib/env";

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  const joined = segments.join("/");
  if (joined !== "screenshot") {
    return NextResponse.json({ detail: "仅支持 POST /api/uploads/screenshot" }, { status: 404 });
  }

  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();
  if (!url || !key) {
    return NextResponse.json({ detail: "Supabase 未配置（SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY）" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ detail: "请上传 file 字段" }, { status: 400 });
  }

  const bucket = getSupabaseStorageBucket();
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const safeName = "name" in file && typeof file.name === "string" ? file.name : "screenshot.png";
  const objectName = `screenshots/${timestamp}_${safeName}`;
  const contentType = file.type || "application/octet-stream";
  const bytes = new Uint8Array(await file.arrayBuffer());

  const client = createClient(url, key);
  const { error } = await client.storage.from(bucket).upload(objectName, bytes, {
    contentType,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ detail: `上传失败: ${error.message}` }, { status: 500 });
  }

  const { data: pub } = client.storage.from(bucket).getPublicUrl(objectName);
  return NextResponse.json({ path: objectName, public_url: pub.publicUrl });
}
