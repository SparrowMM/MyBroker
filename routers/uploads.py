from datetime import datetime
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import get_settings
from services.supabase_client import get_supabase_client


router = APIRouter(prefix="/uploads", tags=["uploads"])
settings = get_settings()


@router.post("/screenshot")
async def upload_screenshot(file: UploadFile = File(...)):
    client = get_supabase_client(use_service_role=True)
    if client is None:
        raise HTTPException(status_code=400, detail="Supabase 未配置（SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY）")

    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    safe_name = file.filename or "screenshot.png"
    object_name = f"screenshots/{timestamp}_{safe_name}"
    content = await file.read()
    try:
        client.storage.from_(settings.supabase_storage_bucket).upload(
            object_name,
            content,
            {"content-type": file.content_type or "application/octet-stream"},
        )
        public_url = client.storage.from_(settings.supabase_storage_bucket).get_public_url(object_name)
        return {"path": object_name, "public_url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {e}")
