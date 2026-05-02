import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { probeTextModel, probeVisionModel } from "@/lib/bailian-client";
import {
  getBailianApiKey,
  getBailianModel,
  getBailianVisionModel,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";

export async function GET() {
  let dbOk = true;
  let dbError = "";
  try {
    await prisma.dailyRecord.findFirst({ select: { id: true } });
  } catch (e) {
    dbOk = false;
    dbError = e instanceof Error ? e.message : String(e);
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServiceRoleKey();
  const supabaseOk = Boolean(supabaseUrl && supabaseKey);
  const supabaseError = supabaseOk ? "" : "缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY";

  const bailianOk = Boolean(getBailianApiKey());
  const bailianError = bailianOk ? "" : "缺少 BAILIAN_API_KEY";

  const textProbe = await probeTextModel();
  const visionProbe = await probeVisionModel();

  return NextResponse.json({
    db: { ok: dbOk, error: dbError },
    supabase: { ok: supabaseOk, error: supabaseError },
    bailian: { ok: bailianOk, error: bailianError },
    llm_text: {
      ok: textProbe.ok,
      model: getBailianModel(),
      error: textProbe.error,
    },
    llm_vision: {
      ok: visionProbe.ok,
      model: getBailianVisionModel(),
      error: visionProbe.error,
    },
  });
}
