import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import type { StreamParams } from "./provider";

const TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("LLM request timed out")), ms)
    ),
  ]);
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("timed out")) return true;
  }
  // Anthropic SDK error shapes
  const e = err as { status?: number };
  if (e?.status && (e.status === 429 || e.status >= 500)) return true;
  return false;
}

export async function routedStream(params: StreamParams): Promise<void> {
  const primary = new AnthropicProvider();
  try {
    await withTimeout(primary.stream(params), TIMEOUT_MS);
    return;
  } catch (err) {
    if (!isRetryableError(err)) throw err;
    console.warn("[agent/router] Anthropic failed, falling back to Gemini:", err);
  }

  const fallback = new GeminiProvider();
  await withTimeout(fallback.stream(params), TIMEOUT_MS);
}
