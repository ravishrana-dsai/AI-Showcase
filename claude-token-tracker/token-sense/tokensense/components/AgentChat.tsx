"use client";

import { useState, useRef, useEffect } from "react";

const C = {
  bg: "#F7F5F0",
  paper: "#FFFFFF",
  ink: "#1A1814",
  inkMid: "#4A4640",
  inkLight: "#8A8680",
  border: "#E0DDD8",
  borderDark: "#C8C4BE",
  gemini: "#1A73E8",
  accent: "#2D6A4F",
  tag: "#F0EDE8",
  warn: "#B5451B",
};

interface Message {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}

const QUICK_PROMPTS = [
  "Audit my costs",
  "What's my biggest waste?",
  "Where can I use prompt caching?",
  "Which model should I downsize?",
  "Show me a batching example",
];

// ─── Inline markdown renderer ─────────────────────────────────────────────────
// Handles: **bold**, `code`, numbered lists, bullet lists, blank-line paragraphs

function renderInline(text: string, key: string | number) {
  // Split on **bold** and `code` spans
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span key={key}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} style={{ fontWeight: 700, color: "inherit" }}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return (
            <code key={i} style={{
              fontFamily: "'DM Mono', monospace", fontSize: 11.5,
              background: "#F0EDE8", borderRadius: 4, padding: "1px 5px",
              color: "#2D6A4F",
            }}>{part.slice(1, -1)}</code>
          );
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function MarkdownBody({ text, streaming }: { text: string; streaming?: boolean }) {
  // Split into blocks by blank lines
  const blocks = text.split(/\n{2,}/);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;

        // Numbered list block
        if (lines[0].match(/^\d+\.\s/)) {
          return (
            <ol key={bi} style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
              {lines.map((line, li) => {
                const content = line.replace(/^\d+\.\s*/, "");
                return <li key={li} style={{ fontSize: 13, lineHeight: 1.65 }}>{renderInline(content, li)}</li>;
              })}
            </ol>
          );
        }

        // Bullet list block
        if (lines[0].match(/^[-*•]\s/)) {
          return (
            <ul key={bi} style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4, listStyle: "none" }}>
              {lines.map((line, li) => {
                const content = line.replace(/^[-*•]\s*/, "");
                return (
                  <li key={li} style={{ fontSize: 13, lineHeight: 1.65, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: C.gemini, flexShrink: 0, marginTop: 2, fontSize: 10 }}>●</span>
                    {renderInline(content, li)}
                  </li>
                );
              })}
            </ul>
          );
        }

        // Code block (triple backtick)
        if (block.startsWith("```")) {
          const code = block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
          return (
            <pre key={bi} style={{
              background: "#F0EDE8", borderRadius: 6, padding: "10px 12px",
              fontSize: 11.5, fontFamily: "'DM Mono', monospace", color: "#4A4640",
              lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre-wrap",
              wordBreak: "break-word", margin: 0,
            }}>{code}</pre>
          );
        }

        // Paragraph (may have inline line breaks within)
        return (
          <p key={bi} style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>
            {lines.map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {renderInline(line, li)}
              </span>
            ))}
          </p>
        );
      })}
      {streaming && (
        <span style={{
          display: "inline-block", width: 7, height: 13,
          background: C.gemini, borderRadius: 1, verticalAlign: "middle",
          animation: "blink 0.8s step-end infinite",
        }} />
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%", background: C.gemini,
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontFamily: "DM Sans, system-ui", fontWeight: 700,
          flexShrink: 0, marginRight: 10, marginTop: 2,
        }}>TS</div>
      )}
      <div style={{
        maxWidth: "86%",
        background: isUser ? C.ink : C.paper,
        color: isUser ? "#fff" : C.ink,
        border: isUser ? "none" : `1.5px solid ${C.border}`,
        borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
        padding: "10px 14px",
        fontFamily: "DM Sans, system-ui",
      }}>
        {isUser ? (
          <span style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{msg.text}</span>
        ) : (
          <MarkdownBody text={msg.text} streaming={msg.streaming} />
        )}
      </div>
    </div>
  );
}

interface AgentChatProps {
  project: string;
}

export default function AgentChat({ project }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi! I'm the TokenSense agent. I have live access to your project's cost data.\n\nTry asking me to audit your costs, explain a flag, or suggest a specific optimization.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", text: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Add placeholder for streaming response
    const assistantIdx = newMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", text: "", streaming: true }]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, project }),
      });

      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIdx] = { role: "assistant", text: current, streaming: true };
          return updated;
        });
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = { role: "assistant", text: accumulated, streaming: false };
        return updated;
      });
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = {
          role: "assistant",
          text: "Sorry, something went wrong. Check that GEMINI_API_KEY is set in .env.local.",
          streaming: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div style={{
      width: 360,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: C.paper,
      borderLeft: `1.5px solid ${C.border}`,
      height: "100%",
    }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .quick-btn:hover { background: ${C.tag} !important; }
        .send-btn:hover:not(:disabled) { opacity: 0.85; }
      `}</style>

      {/* Chat header */}
      <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: C.gemini,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontFamily: "DM Sans, system-ui", fontWeight: 700,
          }}>TS</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: "DM Sans, system-ui" }}>TokenSense Agent</div>
            <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "DM Sans, system-ui" }}>
              Gemini 2.0 Flash · {project}
            </div>
          </div>
          <div style={{
            marginLeft: "auto", width: 8, height: 8, borderRadius: "50%",
            background: C.accent,
          }} />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
        {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div style={{ padding: "8px 14px 0", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
          {QUICK_PROMPTS.map((p) => (
            <button key={p} className="quick-btn" onClick={() => send(p)} disabled={loading} style={{
              background: C.tag, border: `1px solid ${C.border}`, borderRadius: 20,
              padding: "4px 11px", fontSize: 11, color: C.inkMid, cursor: "pointer",
              fontFamily: "DM Sans, system-ui", whiteSpace: "nowrap", flexShrink: 0,
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: "8px 14px 14px", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your costs…"
          rows={1}
          disabled={loading}
          style={{
            flex: 1, resize: "none", border: `1.5px solid ${C.borderDark}`, borderRadius: 10,
            padding: "9px 12px", fontSize: 13, fontFamily: "DM Sans, system-ui",
            color: C.ink, background: C.bg, outline: "none", lineHeight: 1.5,
          }}
        />
        <button
          className="send-btn"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? C.border : C.gemini,
            color: "#fff", border: "none", borderRadius: 10,
            width: 38, height: 38, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {loading ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}
