from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(default="postgresql+psycopg2://postgres:postgres@localhost:5432/card_processor")

    jwt_secret: str = Field(default="dev-insecure-secret-change-me")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expires_minutes: int = Field(default=720)

    seed_admin_username: str = Field(default="admin")
    seed_admin_password: str = Field(default="admin123")

    # Comma-separated string so pydantic-settings doesn't try to JSON-decode it.
    # Expose the parsed list via `cors_origins_list`.
    cors_origins: str = Field(default="http://localhost:5173,http://127.0.0.1:5173")

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
