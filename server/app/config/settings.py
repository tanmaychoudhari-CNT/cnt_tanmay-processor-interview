"""Typed application settings, loaded from env vars / .env file.

Access everywhere via the module-level `settings` singleton (cached by
`get_settings`). Direct `os.environ.get(...)` is a code smell — add a typed
field here instead so the value is validated on boot.
"""
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Sentinels — boot-time assertion fails in production if these are still in
# use. Forces operators to set real values via env vars.
DEFAULT_JWT_SECRET = "dev-insecure-secret-change-me"
DEFAULT_ADMIN_PASSWORD = "admin123"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Deployment environment. In "production" the app refuses to boot with
    # development defaults (JWT secret, admin password, etc).
    environment: str = Field(default="development")

    database_url: str = Field(
        default="postgresql+psycopg2://postgres:postgres@localhost:5432/card_processor"
    )

    jwt_secret: str = Field(default=DEFAULT_JWT_SECRET)
    jwt_algorithm: str = Field(default="HS256")
    # 60 minutes default — short enough that a stolen token expires fast,
    # long enough for typical session work. Override via env if needed.
    jwt_expires_minutes: int = Field(default=60)

    seed_admin_username: str = Field(default="admin")
    seed_admin_password: str = Field(default=DEFAULT_ADMIN_PASSWORD)

    # Minimum password length enforced for new/seeded users.
    password_min_length: int = Field(default=8)

    # Upload hardening.
    max_upload_bytes: int = Field(default=10_000_000)      # 10 MB
    max_upload_rows: int = Field(default=10_000)

    # Comma-separated string so pydantic-settings doesn't try to JSON-decode it.
    # Expose the parsed list via `cors_origins_list`.
    cors_origins: str = Field(default="http://localhost:5173,http://127.0.0.1:5173")

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def assert_production_ready(self) -> None:
        """Raise at boot if production-critical secrets are still defaults."""
        if not self.is_production:
            return
        errors = []
        if self.jwt_secret == DEFAULT_JWT_SECRET:
            errors.append("JWT_SECRET is still the development default")
        if self.seed_admin_password == DEFAULT_ADMIN_PASSWORD:
            errors.append(
                "SEED_ADMIN_PASSWORD is still the well-known 'admin123' default"
            )
        if len(self.jwt_secret) < 32:
            errors.append("JWT_SECRET must be at least 32 characters in production")
        if errors:
            raise RuntimeError(
                "Refusing to start in production with insecure defaults: "
                + "; ".join(errors)
            )


@lru_cache
def get_settings() -> Settings:
    # Cached so we only parse env/.env once per process.
    return Settings()


# Import this from anywhere in the app — it's the single source of truth.
settings = get_settings()
