import { NextRequest, NextResponse } from "next/server";
import { imageToMarkdown } from "@/lib/bailian-client";
import { getBailianApiKey, getBailianVisionModel } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (!getBailianApiKey()) {
    return NextResponse.json({ detail: "缺少 BAILIAN_API_KEY，无法解析本地图片" }, { status: 400 });
  }
  if (!getBailianVisionModel()) {
    return NextResponse.json({ detail: "缺少 BAILIAN_VISION_MODEL，无法解析本地图片" }, { status: 400 });
  }

  const recordDate = req.nextUrl.searchParams.get("record_date");
  if (!recordDate) {
    return NextResponse.json({ detail: "record_date 必填" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return NextResponse.json({ detail: "record_date 格式需为 YYYY-MM-DD" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ detail: "请上传 file 字段" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!buf.length) {
    return NextResponse.json({ detail: "图片内容为空" }, { status: 400 });
  }

  const mime = file.type || "image/png";
  if (!mime.startsWith("image/")) {
    return NextResponse.json({ detail: "仅支持图片文件" }, { status: 400 });
  }

  const markdown = await imageToMarkdown(buf, mime, recordDate);
  if (!markdown) {
    return NextResponse.json(
      {
        detail: `AI 图片解析失败，请检查视觉模型可用性（当前: ${getBailianVisionModel()}）与 API Key 权限`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, record_date: recordDate, markdown });
}
