import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union

class Settings(BaseSettings):
    ENVIRONMENT: str = "dev"
    WEB_PORT: int = 3009
    API_PORT: int = 8200
    
    # Database
    DATABASE_URL: str = "postgresql://ems_user:ems_password_secure_123@localhost:5432/ems_db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Auth & Security
    JWT_SECRET: str = "super_secret_jwt_key_ems_2026_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # Mail (Gmail SMTP default)
    SMTP_PROVIDER: str = "Gmail"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 465
    SMTP_SECURITY: str = "SSL"
    SMTP_USER: str = "oneuni@gmail.com"
    SMTP_PASSWORD: str = ""
    DEFAULT_FROM_EMAIL: str = "oneuni@gmail.com"
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3009,http://127.0.0.1:3009,http://localhost:8200,https://localhost:3000,https://localhost:3009,https://127.0.0.1:3009,https://localhost:8200"
    
    # Seed Toggle
    SEED_DEMO: bool = True

    model_config = SettingsConfigDict(
        env_file=("../.env", "../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, str):
            return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        return self.ALLOWED_ORIGINS

settings = Settings()
