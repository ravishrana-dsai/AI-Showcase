"""
Claude Usage Tracker — mitmproxy addon
Intercepts all Anthropic API calls across Claude Desktop, Cowork, Claude Code,
and Claude.ai browser. Extracts token counts, model, session ID, and forwards
to the Electron dashboard via HTTP on localhost:9877.
"""

import json
import re
import time
import urllib.request
import urllib.error
from datetime import datetime
from mitmproxy import http, ctx

DASHBOARD_URL = "http://127.0.0.1:9877/ingest"

ANTHROPIC_HOSTS = {
    "api.anthropic.com",
    "claude.ai",
}

API_ENDPOINTS = {
    "/v1/messages",
    "/v1/complete",
    "/api/append_message",       # Claude.ai web
    "/api/organizations",        # Claude.ai session calls
}

PRICING = {
    "claude-opus-4":    {"input": 15.00,  "output": 75.00},
    "claude-sonnet-4":  {"input": 3.00,   "output": 15.00},
    "claude-haiku-4":   {"input": 0.80,   "output": 4.00},
    "claude-opus-3":    {"input": 15.00,  "output": 75.00},
    "claude-sonnet-3":  {"input": 3.00,   "output": 15.00},
    "claude-haiku-3":   {"input": 0.25,   "output": 1.25},
    "default":          {"input": 3.00,   "output": 15.00},
}


def get_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    rates = PRICING["default"]
    if model:
        m = model.lower()
        for key, val in PRICING.items():
            if key in m:
                rates = val
                break
    return ((input_tokens * rates["input"]) + (output_tokens * rates["output"])) / 1_000_000


def detect_product(flow: http.HTTPFlow) -> str:
    ua = (flow.request.headers.get("user-agent", "") or "").lower()
    if "claude-code" in ua or "anthropic-code" in ua:
        return "Claude Code"
    if "cowork" in ua or "claude-cowork" in ua:
        return "Cowork"
    # Electron apps on macOS report Electron in UA
    if "electron" in ua:
        # Cowork has its own identifier; fall back to Desktop
        return "Claude Desktop"
    if "mozilla" in ua or "chrome" in ua or "safari" in ua:
        return "Claude.ai (Browser)"
    return "Claude Desktop"


def extract_session_id(flow: http.HTTPFlow, resp_body: dict) -> str | None:
    # 1. From response JSON (Anthropic /v1/messages response has an `id` field)
    if resp_body and isinstance(resp_body, dict):
        if resp_id := resp_body.get("id"):
            return resp_id

    # 2. From URL path (Claude.ai web: /api/organizations/.../conversations/{id}/...)
    path = flow.request.path
    match = re.search(r"/conversations/([a-zA-Z0-9_-]+)", path)
    if match:
        return match.group(1)

    # 3. From request headers
    for header in ("x-session-id", "anthropic-session", "x-conversation-id"):
        if val := flow.request.headers.get(header):
            return val

    return None


def forward_to_dashboard(payload: dict) -> None:
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            DASHBOARD_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=2)
    except urllib.error.URLError:
        # Dashboard not running — print to mitmproxy log instead
        ctx.log.info(f"[Claude Tracker] {payload.get('product')} | "
                     f"model={payload.get('model')} | "
                     f"in={payload.get('inputTokens')} out={payload.get('outputTokens')} | "
                     f"cost=${payload.get('cost', 0):.5f}")
    except Exception as e:
        ctx.log.warn(f"[Claude Tracker] forward error: {e}")


class ClaudeTracker:
    """mitmproxy addon that tracks Claude API usage."""

    def __init__(self):
        self._pending: dict[str, dict] = {}  # flow id → request metadata

    def _is_target(self, flow: http.HTTPFlow) -> bool:
        host = flow.request.pretty_host or ""
        path = flow.request.path or ""
        if not any(h in host for h in ANTHROPIC_HOSTS):
            return False
        return any(path.startswith(ep) for ep in API_ENDPOINTS)

    def request(self, flow: http.HTTPFlow) -> None:
        if not self._is_target(flow):
            return

        try:
            req_body = {}
            if flow.request.content:
                req_body = json.loads(flow.request.content.decode("utf-8", errors="replace"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            req_body = {}

        self._pending[flow.id] = {
            "product": detect_product(flow),
            "endpoint": flow.request.path,
            "model": req_body.get("model", "unknown"),
            "requestedAt": datetime.utcnow().isoformat() + "Z",
        }

    def response(self, flow: http.HTTPFlow) -> None:
        if flow.id not in self._pending:
            return

        meta = self._pending.pop(flow.id)

        # Handle streaming responses (SSE) — collect full body
        resp_body = {}
        input_tokens = 0
        output_tokens = 0

        content_type = flow.response.headers.get("content-type", "")

        if "text/event-stream" in content_type:
            # Parse SSE stream — look for usage in message_delta or message_stop events
            input_tokens, output_tokens = self._parse_sse(flow.response.content)
        else:
            try:
                if flow.response.content:
                    resp_body = json.loads(flow.response.content.decode("utf-8", errors="replace"))
                    usage = resp_body.get("usage", {})
                    input_tokens = usage.get("input_tokens", 0)
                    output_tokens = usage.get("output_tokens", 0)
                    # Claude.ai web sometimes puts usage at top level
                    if not input_tokens:
                        input_tokens = resp_body.get("input_tokens", 0)
                    if not output_tokens:
                        output_tokens = resp_body.get("output_tokens", 0)
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass

        model = meta.get("model") or resp_body.get("model", "unknown")
        if model == "unknown" and resp_body:
            model = resp_body.get("model", "unknown")

        session_id = extract_session_id(flow, resp_body)
        cost = get_cost(model, input_tokens, output_tokens)

        payload = {
            "product":      meta["product"],
            "endpoint":     meta["endpoint"],
            "model":        model,
            "inputTokens":  input_tokens,
            "outputTokens": output_tokens,
            "totalTokens":  input_tokens + output_tokens,
            "cost":         cost,
            "sessionId":    session_id,
            "timestamp":    datetime.utcnow().isoformat() + "Z",
            "statusCode":   flow.response.status_code,
        }

        ctx.log.info(
            f"[Claude] {meta['product']} | {model} | "
            f"↑{input_tokens} ↓{output_tokens} tokens | ${cost:.5f}"
        )
        forward_to_dashboard(payload)

    def _parse_sse(self, content: bytes) -> tuple[int, int]:
        """Parse Server-Sent Events stream to extract final usage counts."""
        input_tokens = 0
        output_tokens = 0

        try:
            text = content.decode("utf-8", errors="replace")
            for line in text.splitlines():
                if not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if data_str in ("", "[DONE]"):
                    continue
                try:
                    event = json.loads(data_str)
                except json.JSONDecodeError:
                    continue

                # message_start has input token count
                if event.get("type") == "message_start":
                    msg = event.get("message", {})
                    usage = msg.get("usage", {})
                    input_tokens = usage.get("input_tokens", input_tokens)

                # message_delta has output token count (final)
                if event.get("type") == "message_delta":
                    usage = event.get("usage", {})
                    output_tokens = usage.get("output_tokens", output_tokens)

                # message_stop sometimes carries usage too
                if event.get("type") == "message_stop":
                    usage = event.get("usage", {})
                    if usage.get("input_tokens"):
                        input_tokens = usage["input_tokens"]
                    if usage.get("output_tokens"):
                        output_tokens = usage["output_tokens"]

        except Exception:
            pass

        return input_tokens, output_tokens


# Register addon
addons = [ClaudeTracker()]
