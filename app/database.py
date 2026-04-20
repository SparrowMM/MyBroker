from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.engine import make_url

from app.config import get_settings


settings = get_settings()

def _with_supabase_pooler_params(url: str) -> str:
    """
    Supabase pooler 场景下统一补充 sslmode=require。
    注意：psycopg 驱动不识别 pgbouncer 连接参数，不能注入该 query。
    """
    if "pooler.supabase.com" not in url.lower():
        return url
    parsed = make_url(url)
    query = dict(parsed.query)
    if "sslmode" not in query:
        parsed = parsed.set(query={**dict(parsed.query), "sslmode": "require"})
    return str(parsed)


resolved_database_url = _with_supabase_pooler_params(settings.database_url)

engine = create_engine(
    resolved_database_url,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if resolved_database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
