"""
FastAPI entry point for the [Company] Pipecat voice server.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
from agent import InterviewPipeline
from interview_brain import DEFAULT_ROLE_SPECS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bridge loguru (used by pipecat) into the standard logging system so that
# Anthropic / Cartesia API errors logged via loguru appear in server output.
try:
    from loguru import logger as _loguru_logger
    import logging as _logging

    class _InterceptHandler(_logging.Handler):
        def emit(self, record: _logging.LogRecord) -> None:
            pass  # stdlib -> loguru handled separately

    # Route loguru to stdlib so both appear in the same stream.
    _loguru_logger.remove()
    _loguru_logger.add(
        lambda msg: print(msg, end=""),
        level="DEBUG",
        colorize=False,
        format="{time:HH:mm:ss} | {level:<8} | {name}:{line} - {message}",
    )
except Exception:
    pass  # loguru not installed — pipecat internal logs simply won't appear

# In-memory session registry: session_id -> InterviewPipeline
_sessions: dict[str, InterviewPipeline] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    logger.info("[Company] Pipecat server starting on port %d", config.SERVER_PORT)
    yield
    logger.info("Shutting down — cancelling active sessions")
    tasks = [
        asyncio.create_task(session._finalize_interview())
        for session in _sessions.values()
        if not session._finalized
    ]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(title="AI Voice Interviewer Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateSessionRequest(BaseModel):
    interview_id: str
    role: str
    candidate_name: str


class CreateSessionResponse(BaseModel):
    room_url: str
    token: str
    session_id: str


async def _create_daily_room(interview_id: str) -> tuple[str, str, str]:
    """Creates a Daily.co room and returns (room_url, bot_token, candidate_token)."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        # Create room
        create_resp = await client.post(
            "https://api.daily.co/v1/rooms",
            headers={"Authorization": f"Bearer {config.DAILY_API_KEY}"},
            json={
                "name": f"dp-{uuid.uuid4().hex[:12]}",
                "properties": {
                    "enable_chat": False,
                    "enable_screenshare": False,
                    "start_video_off": True,
                    "exp": int(time.time()) + 7200,  # 2hr TTL
                },
            },
        )
        create_resp.raise_for_status()
        room_data: dict[str, Any] = create_resp.json()
        room_url: str = room_data["url"]
        room_name: str = room_data["name"]

        # Bot token — owner so it can manage the room
        bot_token_resp = await client.post(
            "https://api.daily.co/v1/meeting-tokens",
            headers={"Authorization": f"Bearer {config.DAILY_API_KEY}"},
            json={
                "properties": {
                    "room_name": room_name,
                    "is_owner": True,
                    "start_video_off": True,
                }
            },
        )
        bot_token_resp.raise_for_status()
        bot_token: str = bot_token_resp.json()["token"]

        # Candidate token — separate identity, not owner
        candidate_token_resp = await client.post(
            "https://api.daily.co/v1/meeting-tokens",
            headers={"Authorization": f"Bearer {config.DAILY_API_KEY}"},
            json={
                "properties": {
                    "room_name": room_name,
                    "is_owner": False,
                    "start_video_off": True,
                }
            },
        )
        candidate_token_resp.raise_for_status()
        candidate_token: str = candidate_token_resp.json()["token"]

    return room_url, bot_token, candidate_token


@app.post("/sessions/create", response_model=CreateSessionResponse)
async def create_session(body: CreateSessionRequest) -> CreateSessionResponse:
    if body.role not in DEFAULT_ROLE_SPECS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown role '{body.role}'. Valid roles: {list(DEFAULT_ROLE_SPECS.keys())}",
        )

    try:
        room_url, bot_token, candidate_token = await _create_daily_room(body.interview_id)
    except httpx.HTTPStatusError as exc:
        logger.error("Daily API error: %s", exc.response.text)
        raise HTTPException(status_code=502, detail="Failed to create Daily room") from exc

    session_id = str(uuid.uuid4())
    pipeline = InterviewPipeline(
        interview_id=body.interview_id,
        room_url=room_url,
        room_token=bot_token,
        role_slug=body.role,
        candidate_name=body.candidate_name,
    )
    _sessions[session_id] = pipeline

    # Run the pipeline in a background task — it blocks until the call ends
    asyncio.create_task(_run_pipeline(session_id, pipeline))

    logger.info(
        "Session %s created for interview %s (%s)",
        session_id,
        body.interview_id,
        body.role,
    )

    return CreateSessionResponse(
        room_url=room_url,
        token=candidate_token,
        session_id=session_id,
    )


async def _run_pipeline(session_id: str, pipeline: InterviewPipeline) -> None:
    try:
        await pipeline.run()
    except Exception as exc:
        import traceback, sys
        tb = traceback.format_exc()
        logger.error("Pipeline error for session %s: %s", session_id, exc)
        print(f"[PIPELINE TRACEBACK] session={session_id}\n{tb}", file=sys.stderr, flush=True)
    finally:
        _sessions.pop(session_id, None)
        logger.info("Session %s cleaned up", session_id)


class RescoreRequest(BaseModel):
    interview_id: str
    role: str
    transcript: list[dict[str, str]]


@app.post("/sessions/rescore")
async def rescore_session(body: RescoreRequest) -> dict[str, Any]:
    role_spec = DEFAULT_ROLE_SPECS.get(body.role, DEFAULT_ROLE_SPECS["software_engineer"])
    pipeline = InterviewPipeline(
        interview_id=body.interview_id,
        room_url="",
        room_token="",
        role_slug=body.role,
        candidate_name="",
    )
    transcript_text = "\n".join(
        f"{e['role'].upper()}: {e['content']}" for e in body.transcript
    )
    scorecard = await pipeline.score_existing_transcript(transcript_text)
    if not scorecard:
        raise HTTPException(status_code=500, detail="Scoring failed")
    return {"scorecard": scorecard}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
