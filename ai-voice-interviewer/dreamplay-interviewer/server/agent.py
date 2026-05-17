"""
Pipecat voice pipeline for [Company] interview sessions.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

import httpx
from pipecat.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    EndFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    TextFrame,
    TranscriptionFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_response import (
    LLMUserContextAggregator,
)
from pipecat.processors.aggregators.openai_llm_context import (
    OpenAILLMContext,
    OpenAILLMContextFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.anthropic import AnthropicLLMService
from pipecat.services.cartesia import CartesiaTTSService
from pipecat.services.deepgram import DeepgramSTTService
from deepgram import LiveOptions
from pipecat.transports.services.daily import DailyParams, DailyTransport
from daily import Daily as _Daily

import config

# ============================================================
# Daily SDK single-process guards
#
# daily-python is designed for one session per process.  Multiple sessions in
# the same process cause panics/errors because:
#   1. Daily.init() must only be called once.
#   2. Virtual devices are created by name ("mic", "speaker", "camera") and
#      the SDK does not allow re-creating them after the first session ends.
#
# We replace each of these calls with guards that run them only once and
# cache the returned device objects for reuse on subsequent sessions.
# ============================================================

_daily_initialized = False
_daily_orig_init = _Daily.init
_daily_device_cache: dict[str, Any] = {}       # name -> device object
_daily_speaker_selected: bool = False

_daily_orig_create_camera = _Daily.create_camera_device
_daily_orig_create_mic = _Daily.create_microphone_device
_daily_orig_create_speaker = _Daily.create_speaker_device
_daily_orig_select_speaker = _Daily.select_speaker_device


def _daily_init_once(*args: Any, **kwargs: Any) -> None:
    global _daily_initialized
    if not _daily_initialized:
        _daily_initialized = True
        _daily_orig_init(*args, **kwargs)


def _daily_create_camera_once(name: str, **kwargs: Any) -> Any:
    if name not in _daily_device_cache:
        _daily_device_cache[name] = _daily_orig_create_camera(name, **kwargs)
    return _daily_device_cache[name]


def _daily_create_mic_once(name: str, **kwargs: Any) -> Any:
    if name not in _daily_device_cache:
        _daily_device_cache[name] = _daily_orig_create_mic(name, **kwargs)
    return _daily_device_cache[name]


def _daily_create_speaker_once(name: str, **kwargs: Any) -> Any:
    if name not in _daily_device_cache:
        _daily_device_cache[name] = _daily_orig_create_speaker(name, **kwargs)
    return _daily_device_cache[name]


def _daily_select_speaker_once(name: str) -> None:
    global _daily_speaker_selected
    if not _daily_speaker_selected:
        _daily_speaker_selected = True
        _daily_orig_select_speaker(name)


_Daily.init = staticmethod(_daily_init_once)  # type: ignore[assignment]
_Daily.create_camera_device = staticmethod(_daily_create_camera_once)  # type: ignore[assignment]
_Daily.create_microphone_device = staticmethod(_daily_create_mic_once)  # type: ignore[assignment]
_Daily.create_speaker_device = staticmethod(_daily_create_speaker_once)  # type: ignore[assignment]
_Daily.select_speaker_device = staticmethod(_daily_select_speaker_once)  # type: ignore[assignment]
from interview_brain import DEFAULT_ROLE_SPECS, InterviewBrain, RoleSpec

logger = logging.getLogger(__name__)


def _extract_json(text: str) -> dict[str, Any]:
    """
    Extract the first JSON object from a string.
    Handles responses where the LLM wraps JSON in prose or markdown code fences.
    Raises json.JSONDecodeError if no valid JSON object is found.
    """
    # 1. Try direct parse first (most common case)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2. Strip markdown code fence if present (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        return json.loads(fence_match.group(1))

    # 3. Find the outermost {...} block in the response
    start = text.find("{")
    if start != -1:
        depth = 0
        for i, ch in enumerate(text[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return json.loads(text[start : i + 1])

    raise json.JSONDecodeError("No JSON object found", text, 0)

CARTESIA_VOICE_ID = "a0e99841-438c-4a64-b679-ae501e7d6091"
INTERVIEW_TIMEOUT_SECS = 30 * 60  # 30-minute hard cutoff
SILENCE_TIMEOUT_SECS = 15         # prompt candidate if silent for 15s
AUTO_END_PHRASE = "your interview is now complete"  # Aria must say this to end


class AudioDebugProcessor(FrameProcessor):
    """Temporary: logs audio frames and checks for actual speech signal."""

    def __init__(self) -> None:
        super().__init__()
        self._frame_count = 0
        self._speech_frames = 0

    async def process_frame(self, frame: Any, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        from pipecat.frames.frames import AudioRawFrame
        import struct, math
        if isinstance(frame, AudioRawFrame):
            self._frame_count += 1
            # Calculate RMS to see if frame has real audio vs silence
            try:
                n = len(frame.audio) // 2
                if n > 0:
                    samples = struct.unpack(f"<{n}h", frame.audio)
                    rms = math.sqrt(sum(s * s for s in samples) / n)
                    if rms > 200:  # threshold above typical background noise
                        self._speech_frames += 1
                        if self._speech_frames <= 5 or self._speech_frames % 50 == 0:
                            logger.info(
                                "AudioDebug: SPEECH DETECTED frame=%d rms=%.0f",
                                self._frame_count, rms,
                            )
            except Exception:
                pass
            if self._frame_count % 500 == 0:
                logger.info(
                    "AudioDebug: %d total frames, %d speech frames",
                    self._frame_count, self._speech_frames,
                )
        await self.push_frame(frame, direction)


class TranscriptEntry:
    __slots__ = ("role", "content")

    def __init__(self, role: str, content: str) -> None:
        self.role = role
        self.content = content

    def to_dict(self) -> dict[str, str]:
        return {"role": self.role, "content": self.content}


class TranscriptCapture(FrameProcessor):
    """
    Captures both sides of the conversation from the pipeline frame stream.
    Also detects Aria's closing phrase to trigger auto-end.

    Maintains the shared OpenAILLMContext by appending Aria's full response as
    a single assistant message after each LLM turn.  This replaces the default
    LLMAssistantContextAggregator, which (in pipecat 0.0.36) uses the per-token
    LLMResponseStartFrame/LLMResponseEndFrame boundaries and therefore adds one
    context entry per streaming delta.  Multiple consecutive assistant entries
    cause the Anthropic API to reject subsequent calls with a role-alternation
    error, silently killing Aria's voice after the first candidate turn.
    """

    def __init__(
        self,
        transcript: list[TranscriptEntry],
        on_auto_end: asyncio.Future[None],
        on_aria_first_spoken: asyncio.Future[None],
        context: "OpenAILLMContext",
        on_candidate_speech: Any = None,
        on_aria_finished_speaking: Any = None,
    ) -> None:
        super().__init__()
        self._transcript = transcript
        self._aria_buffer: list[str] = []
        self._in_llm_response = False
        self._on_auto_end = on_auto_end
        self._on_aria_first_spoken = on_aria_first_spoken
        self._context = context
        self._on_candidate_speech = on_candidate_speech
        self._on_aria_finished_speaking = on_aria_finished_speaking

    async def process_frame(self, frame: Any, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame) and frame.text.strip():
            self._transcript.append(TranscriptEntry("candidate", frame.text.strip()))
            if self._on_candidate_speech:
                self._on_candidate_speech()

        elif isinstance(frame, LLMFullResponseStartFrame):
            self._in_llm_response = True
            self._aria_buffer = []
            logger.info("TC: LLMFullResponseStartFrame — Aria starting response")

        elif isinstance(frame, TextFrame) and self._in_llm_response:
            self._aria_buffer.append(frame.text)
            if len(self._aria_buffer) == 1:
                logger.info("TC: first TextFrame received — '%s...'", frame.text[:30])

        elif isinstance(frame, LLMFullResponseEndFrame):
            self._in_llm_response = False
            combined = "".join(self._aria_buffer).strip()
            if combined:
                self._transcript.append(TranscriptEntry("aria", combined))
                # Add the full response as ONE assistant message so the context
                # stays properly alternating (user → assistant → user → …).
                self._context.add_message({"role": "assistant", "content": combined})
                logger.info("Context updated: added assistant message (%d chars)", len(combined))
                if not self._on_aria_first_spoken.done():
                    self._on_aria_first_spoken.set_result(None)
                # Reset silence clock so it starts from when Aria finishes,
                # not from the last candidate speech.
                if self._on_aria_finished_speaking:
                    self._on_aria_finished_speaking()
                # Trigger auto-end when Aria says the closing phrase
                if (
                    AUTO_END_PHRASE in combined.lower()
                    and not self._on_auto_end.done()
                ):
                    logger.info("Auto-end phrase detected — ending interview")
                    self._on_auto_end.set_result(None)
            self._aria_buffer = []

        await self.push_frame(frame, direction)


class _DiagnosticAnthropicLLM(AnthropicLLMService):
    """Drop-in wrapper that logs context shape before each Anthropic call."""

    async def _process_context(self, context: Any) -> None:  # type: ignore[override]
        msgs = context.get_messages()
        roles = " -> ".join(m["role"] for m in msgs)
        logger.info(
            "LLM invoked: %d messages, roles: [%s]",
            len(msgs),
            roles,
        )
        await super()._process_context(context)


class InterviewPipeline:
    """Manages one interview session end-to-end."""

    def __init__(
        self,
        interview_id: str,
        room_url: str,
        room_token: str,
        role_slug: str,
        candidate_name: str,
    ) -> None:
        self.interview_id = interview_id
        self.room_url = room_url
        self.room_token = room_token
        self.candidate_name = candidate_name
        self.role_spec: RoleSpec = DEFAULT_ROLE_SPECS.get(
            role_slug, DEFAULT_ROLE_SPECS["software_engineer"]
        )
        self.brain = InterviewBrain()
        self.transcript: list[TranscriptEntry] = []
        self._runner: PipelineRunner | None = None
        self._task: PipelineTask | None = None
        self._finalized: bool = False
        self._aria_first_spoken: bool = False
        self._last_candidate_speech: float = asyncio.get_event_loop().time()

    async def run(self) -> None:
        loop = asyncio.get_event_loop()
        auto_end_future: asyncio.Future[None] = loop.create_future()
        aria_first_spoken_future: asyncio.Future[None] = loop.create_future()

        transport = DailyTransport(
            self.room_url,
            self.room_token,
            "Aria ([Company])",
            DailyParams(
                audio_out_enabled=True,
                audio_in_enabled=True,
                vad_enabled=True,
                vad_analyzer=SileroVADAnalyzer(),
                vad_audio_passthrough=True,  # forward audio to Deepgram even when VAD is active
                transcription_enabled=False,
            ),
        )

        stt = DeepgramSTTService(
            api_key=config.DEEPGRAM_API_KEY,
            live_options=LiveOptions(
                model="nova-2",
                language="en-US",
                encoding="linear16",
                sample_rate=16000,
                channels=1,
                interim_results=True,
                smart_format=True,
            ),
        )

        llm = AnthropicLLMService(
            api_key=config.ANTHROPIC_API_KEY,
            model="claude-sonnet-4-6",
            max_tokens=512,
        )

        tts = CartesiaTTSService(
            api_key=config.CARTESIA_API_KEY,
            voice_id=CARTESIA_VOICE_ID,
            model="sonic-english",
        )

        def _on_candidate_speech() -> None:
            self._last_candidate_speech = loop.time()

        def _on_aria_finished_speaking() -> None:
            # Restart the silence clock from now so we give the candidate
            # a full SILENCE_TIMEOUT_SECS after Aria stops talking.
            self._last_candidate_speech = loop.time()

        system_prompt = self.brain.get_system_prompt(self.role_spec)
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"The candidate's name is {self.candidate_name}. "
                    "Please begin the interview with your warm greeting now."
                ),
            },
        ]

        context = OpenAILLMContext(messages=messages)
        user_aggregator = LLMUserContextAggregator(context)
        # NOTE: We do NOT use LLMAssistantContextAggregator here.
        # That aggregator uses per-token LLMResponseStartFrame/EndFrame boundaries
        # and adds one context entry per streaming delta, creating consecutive
        # assistant messages that Anthropic rejects.  Instead, TranscriptCapture
        # adds the full Aria response as one assistant message after each turn.

        transcript_capture = TranscriptCapture(
            self.transcript,
            auto_end_future,
            aria_first_spoken_future,
            context=context,
            on_candidate_speech=_on_candidate_speech,
            on_aria_finished_speaking=_on_aria_finished_speaking,
        )

        pipeline = Pipeline(
            [
                transport.input(),
                stt,
                user_aggregator,
                llm,
                transcript_capture,
                tts,
                transport.output(),
            ]
        )

        self._task = PipelineTask(
            pipeline,
            params=PipelineParams(allow_interruptions=False),
        )

        @transport.event_handler("on_first_participant_joined")
        async def on_connected(transport_ref: Any, participant: Any) -> None:
            participant_id = participant.get("id", "unknown")
            logger.info(
                "Candidate connected to interview %s: %s",
                self.interview_id,
                participant_id,
            )
            # Explicitly subscribe to the candidate's audio so the Daily SDK
            # routes their audio to the bot's virtual speaker device.
            try:
                transport._client._client.update_subscriptions(
                    participant_settings={participant_id: {"media": "subscribed"}}
                )
                logger.info("Subscribed to audio for participant %s", participant_id)
            except Exception as exc:
                logger.warning("Could not subscribe to participant audio: %s", exc)
            self._last_candidate_speech = loop.time()
            await self._task.queue_frames([OpenAILLMContextFrame(context)])

        @transport.event_handler("on_participant_left")
        async def on_disconnected(transport_ref: Any, participant: Any, reason: str) -> None:
            logger.info("Candidate disconnected from interview %s", self.interview_id)
            if not auto_end_future.done():
                auto_end_future.cancel()
            await self._finalize_interview()
            await self._task.cancel()

        self._runner = PipelineRunner()

        # Run pipeline + watchers concurrently; first to finish wins
        pipeline_task = asyncio.create_task(self._runner.run(self._task))
        silence_task = asyncio.create_task(
            self._silence_watcher(context, loop, aria_first_spoken_future)
        )
        timeout_task = asyncio.create_task(
            asyncio.sleep(INTERVIEW_TIMEOUT_SECS)
        )

        try:
            done, pending = await asyncio.wait(
                [pipeline_task, asyncio.ensure_future(auto_end_future), timeout_task],
                return_when=asyncio.FIRST_COMPLETED,
            )

            if timeout_task in done:
                logger.warning("Interview %s timed out at 45 minutes", self.interview_id)
                await self._push_timeout_end()

            if not auto_end_future.done():
                auto_end_future.cancel()

            for t in pending:
                t.cancel()

        except asyncio.CancelledError:
            pass
        finally:
            silence_task.cancel()
            if not self._finalized:
                await self._finalize_interview()

    async def _silence_watcher(
        self,
        context: OpenAILLMContext,
        loop: asyncio.AbstractEventLoop,
        aria_first_spoken: asyncio.Future[None],
    ) -> None:
        """Prompts the candidate if silence exceeds SILENCE_TIMEOUT_SECS."""
        # Wait until Aria has delivered her opening before watching for silence
        try:
            await asyncio.wait_for(asyncio.shield(aria_first_spoken), timeout=120)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            return
        self._last_candidate_speech = loop.time()
        while True:
            await asyncio.sleep(5)
            elapsed = loop.time() - self._last_candidate_speech
            if elapsed >= SILENCE_TIMEOUT_SECS and self._task and not self._finalized:
                logger.info(
                    "Silence detected in interview %s — prompting candidate",
                    self.interview_id,
                )
                context.add_message({
                    "role": "user",
                    "content": "[The candidate has been silent. Please check in with them briefly.]",
                })
                await self._task.queue_frames([OpenAILLMContextFrame(context)])
                self._last_candidate_speech = loop.time()

    async def _push_timeout_end(self) -> None:
        await self._push_status_to_nextjs("timed_out")

    async def _push_status_to_nextjs(self, status: str) -> None:
        url = f"{config.NEXTJS_API_URL}/api/interviews/{self.interview_id}/status"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.patch(url, json={"status": status})
        except Exception as exc:
            logger.error("Failed to push status %s for %s: %s", status, self.interview_id, exc)

    async def _finalize_interview(self) -> None:
        if self._finalized:
            return
        self._finalized = True

        raw_transcript = [e.to_dict() for e in self.transcript]
        transcript_text = "\n".join(
            f"{e['role'].upper()}: {e['content']}" for e in raw_transcript
        )

        scorecard: dict[str, Any] | None = None
        # Only score if there is at least one candidate message in the transcript.
        candidate_turns = [e for e in raw_transcript if e["role"] == "candidate"]
        if not candidate_turns:
            logger.info(
                "Skipping scoring for interview %s — no candidate responses",
                self.interview_id,
            )
        else:
            try:
                import anthropic
                client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)
                scoring_prompt = self.brain.get_scoring_prompt(transcript_text, self.role_spec)
                response = await client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=1024,
                    messages=[{"role": "user", "content": scoring_prompt}],
                )
                raw_text = response.content[0].text.strip()
                scorecard = _extract_json(raw_text)
                logger.info("Scoring complete for interview %s", self.interview_id)
            except Exception as exc:
                logger.error("Scoring failed for interview %s: %s", self.interview_id, exc)

        await self._push_results(raw_transcript, scorecard)

    async def score_existing_transcript(self, transcript_text: str) -> dict[str, Any] | None:
        """Called by the rescore endpoint with an existing transcript."""
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)
            scoring_prompt = self.brain.get_scoring_prompt(transcript_text, self.role_spec)
            response = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                messages=[{"role": "user", "content": scoring_prompt}],
            )
            return _extract_json(response.content[0].text.strip())
        except Exception as exc:
            logger.error("Rescore failed for interview %s: %s", self.interview_id, exc)
            return None

    async def _push_results(
        self,
        transcript: list[dict[str, str]],
        scorecard: dict[str, Any] | None,
    ) -> None:
        url = f"{config.NEXTJS_API_URL}/api/interviews/{self.interview_id}/complete"
        payload = {"transcript": transcript, "scorecard": scorecard}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                logger.info("Results pushed to Next.js for interview %s", self.interview_id)
        except Exception as exc:
            logger.error(
                "Failed to push results for interview %s: %s", self.interview_id, exc
            )
