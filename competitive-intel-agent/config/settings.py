from pydantic_settings import BaseSettings
from pydantic import Field
from pydantic_settings import SettingsConfigDict
import os


class Settings(BaseSettings):
    # AI providers
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    llm_provider: str = "auto"  # auto | anthropic | gemini

    # Slack
    slack_bot_token: str = ""
    slack_channel_ci: str = ""
    slack_channel_alerts: str = ""
    slack_channel_prds: str = ""
    slack_channel_admin: str = ""

    # News
    newsapi_key: str = ""

    # Reddit
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "[Company]CI/1.0"

    # Twitter
    twitter_bearer_token: str = ""
    enable_twitter: bool = False

    # Patents
    epo_ops_key: str = ""
    epo_ops_secret: str = ""
    enable_patents: bool = True

    # Scraping
    enable_linkedin_scrape: bool = True
    linkedin_email: str = ""
    linkedin_password: str = ""

    # Storage
    database_url: str = ""
    db_path: str = "./data/ci_bot.db"  # kept for local/legacy use
    snapshots_dir: str = "./data/snapshots"
    prds_dir: str = "./data/prds"

    # Logging
    log_level: str = "INFO"
    log_file: str = "./data/ci_bot.log"

    # Scheduler
    scheduler_timezone: str = "Asia/Kolkata"

    # App Store
    app_store_country: str = "us"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
