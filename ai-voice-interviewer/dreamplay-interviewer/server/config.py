import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)


def _require(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value


ANTHROPIC_API_KEY: str = _require("ANTHROPIC_API_KEY")
DEEPGRAM_API_KEY: str = _require("DEEPGRAM_API_KEY")
CARTESIA_API_KEY: str = _require("CARTESIA_API_KEY")
DAILY_API_KEY: str = _require("DAILY_API_KEY")
DATABASE_URL: str = _require("DATABASE_URL")
SLACK_WEBHOOK_URL: str = os.getenv("SLACK_WEBHOOK_URL", "")
SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))
NEXTJS_API_URL: str = os.getenv("NEXTJS_API_URL", "http://localhost:3000")
