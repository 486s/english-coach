from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    应用配置，自动从 .env 文件和环境变量读取
    """
    database_url: str = "postgresql+asyncpg://coach:secret@localhost:5432/englishcoach"
    redis_url: str = "redis://localhost:6379/0"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8"
    }

# 全局配置实例
settings = Settings()