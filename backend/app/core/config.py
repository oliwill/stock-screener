from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    tushare_token: str
    cache_days: int = 7  # 缓存天数
    limit_up_threshold: float = 0.095  # 涨停阈值 9.5% (容错)
    lookback_days: int = 180  # 回溯天数（半年）

    class Config:
        env_file = ".env"


settings = Settings()
