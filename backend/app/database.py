import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_KEY: str

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# 🌟 CRUCIAL STEP: Force query string parameters into the DATABASE_URL
# This completely strips out prepared statements from SQLAlchemy's background handshakes.
db_url = settings.DATABASE_URL
if "prepared_statement_cache_size" not in db_url:
    separator = "&" if "?" in db_url else "?"
    db_url = f"{db_url}{separator}prepared_statement_cache_size=0"

# Setup the asynchronous DB Engine
engine = create_async_engine(
    db_url,               # Use our modified URL string
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args={
        "statement_cache_size": 0  # Disables runtime query optimization cache
    },
    execution_options={
        "compiled_cache": None     # Turns off internal compiler caching
    }
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
