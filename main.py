from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from routers.action_items import router as action_items_router
from routers.briefings import router as briefings_router
from routers.notifications import router as notifications_router
from routers.projects import router as projects_router
from routers.records import router as records_router
from routers.uploads import router as uploads_router
from routers.v2 import router as v2_router
from services.scheduler import start_scheduler, stop_scheduler


settings = get_settings()
app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)
    start_scheduler()


@app.on_event("shutdown")
def on_shutdown():
    stop_scheduler()


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}


app.include_router(records_router)
app.include_router(projects_router)
app.include_router(action_items_router)
app.include_router(briefings_router)
app.include_router(notifications_router)
app.include_router(uploads_router)
app.include_router(v2_router)
