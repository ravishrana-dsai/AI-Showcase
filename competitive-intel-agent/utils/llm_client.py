from __future__ import annotations
"""
Dual AI abstraction layer: Anthropic (primary) + Gemini (fallback).
All processors use this unified interface instead of importing SDKs directly.
"""

import json
import os
from typing import Any
from utils.logger import get_logger

logger = get_logger(__name__)

_COST_PER_1K_TOKENS = {
    "anthropic": {"input": 0.003, "output": 0.015},
    "gemini": {"input": 0.000075, "output": 0.0003},
    "claude-haiku-4-5": {"input": 0.00025, "output": 0.00125},
}


def _looks_like_anthropic_api_key(key: str) -> bool:
    """Anthropic console keys are sk-ant-...; placeholders won't match, so auto can fall back to Gemini."""
    return bool(key) and key.startswith("sk-ant")


class LLMClient:
    """
    Unified LLM client.
    - If ANTHROPIC_API_KEY is set (and LLM_PROVIDER != 'gemini'): uses Claude claude-sonnet-4-6
    - If only GEMINI_API_KEY is set (or LLM_PROVIDER == 'gemini'): uses Gemini 2.0 Flash
    - LLM_PROVIDER=auto: Anthropic wins only if the key looks like a real sk-ant-... key; otherwise Gemini if set
    - If Anthropic returns 401 and GEMINI_API_KEY is set, falls back to Gemini (unless LLM_PROVIDER=anthropic)
    """

    def __init__(self):
        # Strip inline comments (e.g. "auto  # auto | anthropic | gemini" → "auto")
        provider_override = os.getenv("LLM_PROVIDER", "auto").split("#")[0].strip().lower()
        anthropic_key = (os.getenv("ANTHROPIC_API_KEY", "") or "").strip()
        gemini_key = (os.getenv("GEMINI_API_KEY", "") or "").strip()

        if provider_override == "gemini":
            if not gemini_key:
                raise ValueError("LLM_PROVIDER=gemini requires GEMINI_API_KEY in .env")
            self.provider = "gemini"
        elif provider_override == "anthropic":
            if not anthropic_key:
                raise ValueError("LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY in .env")
            self.provider = "anthropic"
        elif provider_override in ("auto", ""):
            if _looks_like_anthropic_api_key(anthropic_key):
                self.provider = "anthropic"
            elif gemini_key:
                self.provider = "gemini"
            elif anthropic_key:
                raise ValueError(
                    "ANTHROPIC_API_KEY is set but does not look like an Anthropic key (expected sk-ant-...). "
                    "Remove or fix it, or set LLM_PROVIDER=gemini and use GEMINI_API_KEY."
                )
            else:
                raise ValueError(
                    "No AI provider key found. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env"
                )
        elif anthropic_key:
            self.provider = "anthropic"
        elif gemini_key:
            self.provider = "gemini"
        else:
            raise ValueError(
                "No AI provider key found. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env"
            )

        # When True, never switch to Gemini after an Anthropic auth failure.
        self._anthropic_only = provider_override == "anthropic"

        self._init_client()
        logger.info("LLM provider initialized", provider=self.provider, model=self.model)

    def _init_client(self):
        if self.provider == "anthropic":
            import anthropic
            self._client = anthropic.Anthropic()
            self.model = "claude-sonnet-4-6"
        else:
            try:
                from google import genai
                self._client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
                self.model = "gemini-2.0-flash"
            except (ImportError, AttributeError):
                # google-generativeai not installed; fall back to Anthropic
                logger.warning("google-generativeai not available, falling back to Anthropic")
                self.provider = "anthropic"
                import anthropic
                self._client = anthropic.Anthropic()
                self.model = "claude-sonnet-4-6"

    def _gemini_key_available(self) -> bool:
        return bool((os.getenv("GEMINI_API_KEY", "") or "").strip())

    def _fallback_to_gemini_on_auth_failure(self) -> bool:
        return not self._anthropic_only and self._gemini_key_available()

    def _switch_to_gemini(self) -> None:
        self.provider = "gemini"
        self._init_client()

    def record_usage(
        self,
        input_tokens: int,
        output_tokens: int,
        processor_type: str = None,
        competitor_id: str = None,
        model: str | None = None,
    ) -> None:
        """Persist token usage to DB for cost tracking. Never raises."""
        try:
            used_model = model or self.model
            # Look up rate by provider first, fallback to model-specific rate
            rates = _COST_PER_1K_TOKENS.get(self.provider, {"input": 0.0, "output": 0.0})
            # Override rates if model has its own entry in cost map
            if used_model in _COST_PER_1K_TOKENS:
                rates = _COST_PER_1K_TOKENS[used_model]
            cost = (input_tokens / 1000.0 * rates["input"]) + (output_tokens / 1000.0 * rates["output"])
            from db import database
            database.insert_llm_usage(
                provider=self.provider,
                model=used_model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost,
                processor_type=processor_type,
                competitor_id=competitor_id,
            )
        except Exception as exc:
            logger.debug("Cost tracking failed (non-fatal)", error=str(exc))

    def complete(
        self,
        system: str,
        user: str,
        schema: dict | None = None,
        max_tokens: int = 4096,
        model_override: str | None = None,
    ) -> dict | str:
        """
        Unified completion call.

        Args:
            system: System prompt
            user: User message
            schema: If provided, forces structured JSON output matching this JSON Schema
            max_tokens: Maximum tokens in response
            model_override: Optional model ID to use instead of self.model (e.g. for Haiku)

        Returns:
            dict if schema provided, str otherwise
        """
        if self.provider == "anthropic":
            from anthropic import AuthenticationError

            try:
                return self._anthropic_complete(system, user, schema, max_tokens, model_override)
            except AuthenticationError:
                if self._fallback_to_gemini_on_auth_failure():
                    logger.warning("Anthropic authentication failed; retrying with Gemini")
                    self._switch_to_gemini()
                    return self._gemini_complete(system, user, schema, max_tokens, model_override)
                raise
        else:
            return self._gemini_complete(system, user, schema, max_tokens, model_override)

    def _anthropic_complete(
        self,
        system: str,
        user: str,
        schema: dict | None,
        max_tokens: int,
        model_override: str | None = None,
    ) -> dict | str:
        import anthropic

        used_model = model_override or self.model

        if schema:
            # Force structured JSON output via tool_choice
            tools = [{
                "name": "structured_output",
                "description": "Output the analysis result as structured JSON",
                "input_schema": schema,
            }]
            response = self._client.messages.create(
                model=used_model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                tools=tools,
                tool_choice={"type": "tool", "name": "structured_output"},
            )
            try:
                self.record_usage(response.usage.input_tokens, response.usage.output_tokens, model=model_override)
            except Exception:
                pass
            for block in response.content:
                if block.type == "tool_use":
                    return block.input
            raise ValueError("No tool_use block in Anthropic response")
        else:
            response = self._client.messages.create(
                model=used_model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            try:
                self.record_usage(response.usage.input_tokens, response.usage.output_tokens, model=model_override)
            except Exception:
                pass
            return response.content[0].text

    def _gemini_complete(
        self,
        system: str,
        user: str,
        schema: dict | None,
        max_tokens: int,
        model_override: str | None = None,
    ) -> dict | str:
        from google import genai
        from google.genai import types as genai_types

        full_prompt = f"{system}\n\n{user}"
        config_kwargs: dict[str, Any] = {"max_output_tokens": max_tokens}

        if schema:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_schema"] = schema

        config = genai_types.GenerateContentConfig(**config_kwargs)
        response = self._client.models.generate_content(
            model=self.model,
            contents=full_prompt,
            config=config,
        )
        try:
            um = getattr(response, 'usage_metadata', None)
            if um:
                self.record_usage(
                    getattr(um, 'prompt_token_count', 0),
                    getattr(um, 'candidates_token_count', 0),
                )
        except Exception:
            pass
        text = response.text

        if schema:
            try:
                return json.loads(text)
            except (json.JSONDecodeError, TypeError):
                import re
                match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text or "")
                if match:
                    return json.loads(match.group(1))
                raise ValueError(f"Could not parse JSON from Gemini response: {(text or '')[:200]}")
        return text

    def complete_with_tools(
        self,
        system: str,
        user: str,
        tools: list[dict],
        tool_handler: callable,
        max_iterations: int = 10,
    ) -> str:
        """
        Agentic tool-calling loop for orchestrator.
        Continues calling Claude with tool results until stop_reason == 'end_turn'.

        tool_handler(tool_name, tool_input) -> dict (the tool result)

        Returns the final text response.
        """
        if self.provider == "anthropic":
            from anthropic import AuthenticationError

            try:
                return self._anthropic_tool_loop(system, user, tools, tool_handler, max_iterations)
            except AuthenticationError:
                if self._fallback_to_gemini_on_auth_failure():
                    logger.warning("Anthropic authentication failed; using Gemini for tool loop")
                    self._switch_to_gemini()
                    return self._gemini_tool_simulation(system, user, tools, tool_handler)
                raise
        else:
            # Gemini: simulate tool loop via prompt chaining
            return self._gemini_tool_simulation(system, user, tools, tool_handler)

    def _anthropic_tool_loop(
        self,
        system: str,
        user: str,
        tools: list[dict],
        tool_handler: callable,
        max_iterations: int,
    ) -> str:
        import anthropic

        messages = [{"role": "user", "content": user}]
        iterations = 0

        while iterations < max_iterations:
            response = self._client.messages.create(
                model=self.model,
                max_tokens=8096,
                system=system,
                messages=messages,
                tools=tools,
            )

            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                # Return the final text block
                for block in response.content:
                    if hasattr(block, "text"):
                        return block.text
                return ""

            # Process tool_use blocks
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = tool_handler(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result),
                    })

            if tool_results:
                messages.append({"role": "user", "content": tool_results})

            iterations += 1

        logger.warning("Tool loop hit max iterations", max=max_iterations)
        return "Analysis incomplete: max iterations reached."

    def _gemini_tool_simulation(
        self,
        system: str,
        user: str,
        tools: list[dict],
        tool_handler: callable,
    ) -> str:
        """
        For Gemini: describe available tools in the prompt and parse tool calls from response.
        Simple simulation since Gemini's function calling API differs.
        """
        tool_descriptions = "\n".join(
            f"- {t['name']}: {t.get('description', '')}" for t in tools
        )
        prompt = (
            f"{system}\n\n"
            f"Available analysis tools (call them by responding with JSON like "
            f'`{{"call_tool": "tool_name", "args": {{...}}}}`): \n{tool_descriptions}\n\n'
            f"{user}\n\n"
            "Analyze the situation and call the relevant tools, then provide your final synthesis."
        )
        response = self._client.models.generate_content(
            model=self.model,
            contents=prompt,
        )
        return response.text


# Singleton instance (created lazily)
_client_instance: LLMClient | None = None


def get_llm_client() -> LLMClient:
    global _client_instance
    if _client_instance is None:
        _client_instance = LLMClient()
    return _client_instance
