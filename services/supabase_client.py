from typing import Optional

from supabase import Client, create_client

from app.config import get_settings


def get_supabase_client(use_service_role: bool = True) -> Optional[Client]:
    settings = get_settings()
    if not settings.supabase_url:
        return None
    key = settings.supabase_service_role_key if use_service_role else settings.supabase_publishable_key
    if not key:
        return None
    return create_client(settings.supabase_url, key)
