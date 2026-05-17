"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DailyIframe, {
  DailyCall,
  DailyEvent,
  DailyParticipant,
} from "@daily-co/daily-js";
import { AudioVisualizer } from "@/components/AudioVisualizer";

type Stage = "waiting" | "connecting" | "active" | "completed";

interface InterviewRoomProps {
  interviewId: string;
  candidateName: string;
  roleTitle: string;
  initialStatus: string;
}

export function InterviewRoom({
  interviewId,
  candidateName,
  roleTitle,
  initialStatus,
}: InterviewRoomProps) {
  const [stage, setStage] = useState<Stage>(
    initialStatus === "completed" ? "completed" : "waiting"
  );
  const [isMuted, setIsMuted] = useState(false);
  const [ariaIsSpeaking, setAriaIsSpeaking] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const callRef = useRef<DailyCall | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setElapsedSecs((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startInterview = useCallback(async () => {
    setStage("connecting");
    setError(null);

    // Unlock browser autoplay with a silent AudioContext triggered by the
    // user gesture — without this, el.play() on remote tracks is blocked.
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      ctx.close();
    } catch {
      // Non-fatal — continue regardless
    }

    // Explicitly request microphone access before joining Daily so the
    // browser permission prompt fires here rather than silently failing.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // release immediately; Daily will reacquire
    } catch (err) {
      setError("Microphone access is required. Please allow microphone access in your browser and try again.");
      setStage("waiting");
      return;
    }

    try {
      const res = await fetch(`/api/interviews/${interviewId}/start`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to start interview");
      }

      const { roomUrl, token } = (await res.json()) as {
        roomUrl: string;
        token: string;
      };

      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      });

      callRef.current = call;

      // Manually attach remote audio tracks to <audio> elements so playback
      // works regardless of browser autoplay policy
      const audioElements = new Map<string, HTMLAudioElement>();

      const attachAudio = (sessionId: string, track: MediaStreamTrack) => {
        let el = audioElements.get(sessionId);
        if (!el) {
          el = document.createElement("audio");
          el.autoplay = true;
          el.style.display = "none";
          document.body.appendChild(el);
          audioElements.set(sessionId, el);
        }
        el.srcObject = new MediaStream([track]);
        el.play().catch(() => {});
      };

      const removeAudio = (sessionId: string) => {
        const el = audioElements.get(sessionId);
        if (el) {
          el.srcObject = null;
          document.body.removeChild(el);
          audioElements.delete(sessionId);
        }
      };

      call.on("track-started" as DailyEvent, (event: unknown) => {
        const e = event as { participant?: { session_id?: string }; track?: MediaStreamTrack } | undefined;
        if (e?.track?.kind === "audio" && e.participant?.session_id && e.track) {
          attachAudio(e.participant.session_id, e.track);
        }
      });

      call.on("participant-left" as DailyEvent, (event: unknown) => {
        const e = event as { participant?: { session_id?: string } } | undefined;
        if (e?.participant?.session_id) removeAudio(e.participant.session_id);
      });

      call.on("joined-meeting" as DailyEvent, () => {
        // Log local audio state so we can diagnose mic publishing issues
        const participants = call.participants() as Record<string, DailyParticipant & { audio?: boolean; tracks?: { audio?: { state?: string } } }>;
        const local = participants?.local;
        console.log("[Daily] joined-meeting — local audio:", local?.audio, "track state:", local?.tracks?.audio?.state);
        setStage("active");
        startTimer();
      });

      call.on("left-meeting" as DailyEvent, () => {
        audioElements.forEach((_, id) => removeAudio(id));
        setStage("completed");
        stopTimer();
      });

      call.on("error" as DailyEvent, (err: unknown) => {
        const message =
          err && typeof err === "object" && "errorMsg" in err
            ? String((err as { errorMsg: unknown }).errorMsg)
            : "Connection error";
        audioElements.forEach((_, id) => removeAudio(id));
        setError(message);
        setStage("waiting");
        stopTimer();
      });

      call.on("active-speaker-change" as DailyEvent, (event: unknown) => {
        const e = event as { activeSpeaker?: { peerId?: string } } | undefined;
        const speakerId = e?.activeSpeaker?.peerId ?? "";
        const participants = call.participants() as Record<string, DailyParticipant>;
        const speaker = participants[speakerId];
        const isAria =
          speaker &&
          typeof (speaker as { user_name?: string }).user_name === "string" &&
          (speaker as { user_name?: string }).user_name!.includes("Aria");
        setAriaIsSpeaking(Boolean(isAria));
      });

      await call.join({ url: roomUrl, token });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setError(msg);
      setStage("waiting");
    }
  }, [interviewId, startTimer, stopTimer]);

  const toggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const next = !isMuted;
    call.setLocalAudio(!next);
    setIsMuted(next);
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      callRef.current?.leave().then(() => callRef.current?.destroy()).catch(() => {});
    };
  }, [stopTimer]);

  return (
    <main style={styles.root}>
      <div style={styles.card}>
        {/* Logo / Brand */}
        <div style={styles.brand}>
          <span style={styles.brandDot} />
          <span style={styles.brandName}>[Company]</span>
        </div>

        {stage === "waiting" && (
          <WaitingState
            candidateName={candidateName}
            roleTitle={roleTitle}
            error={error}
            onStart={startInterview}
          />
        )}

        {stage === "connecting" && <ConnectingState />}

        {stage === "active" && (
          <ActiveState
            candidateName={candidateName}
            roleTitle={roleTitle}
            elapsedSecs={elapsedSecs}
            isMuted={isMuted}
            ariaIsSpeaking={ariaIsSpeaking}
            onToggleMute={toggleMute}
          />
        )}

        {stage === "completed" && (
          <CompletedState candidateName={candidateName} />
        )}
      </div>
    </main>
  );
}

function WaitingState({
  candidateName,
  roleTitle,
  error,
  onStart,
}: {
  candidateName: string;
  roleTitle: string;
  error: string | null;
  onStart: () => void;
}) {
  return (
    <div style={styles.section}>
      <h1 style={styles.heading}>Hi, {candidateName}</h1>
      <p style={styles.subheading}>{roleTitle}</p>
      <div style={styles.divider} />
      <p style={styles.body}>
        You are about to start your first-round interview with [Company]. Aria,
        our AI interviewer, will ask you 6 questions. This typically takes 15 to
        20 minutes.
      </p>
      <ul style={styles.checklist}>
        <li>Find a quiet place with a good internet connection</li>
        <li>Use headphones if possible to avoid echo</li>
        <li>Speak clearly — your audio will be reviewed by our team</li>
      </ul>
      {error && <p style={styles.errorText}>{error}</p>}
      <button style={styles.primaryBtn} onClick={onStart}>
        Start Interview
      </button>
    </div>
  );
}

function ConnectingState() {
  return (
    <div style={{ ...styles.section, alignItems: "center" }}>
      <div style={styles.spinner} />
      <p style={styles.body}>Setting up your interview...</p>
    </div>
  );
}

function ActiveState({
  candidateName,
  roleTitle,
  elapsedSecs,
  isMuted,
  ariaIsSpeaking,
  onToggleMute,
}: {
  candidateName: string;
  roleTitle: string;
  elapsedSecs: number;
  isMuted: boolean;
  ariaIsSpeaking: boolean;
  onToggleMute: () => void;
}) {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div style={{ ...styles.section, alignItems: "center", gap: 24 }}>
      <div style={styles.metaRow}>
        <span style={styles.metaLabel}>{candidateName}</span>
        <span style={styles.metaSep}>·</span>
        <span style={styles.metaLabel}>{roleTitle}</span>
        <span style={styles.metaSep}>·</span>
        <span style={styles.timer}>{formatTime(elapsedSecs)}</span>
      </div>

      {/* Visualizer hero */}
      <div style={styles.visualizerWrap}>
        <AudioVisualizer isActive={!isMuted} isSpeaking={ariaIsSpeaking} />
      </div>

      {/* Speaker indicator */}
      <div style={styles.speakerIndicator}>
        <span
          style={{
            ...styles.speakerDot,
            background: ariaIsSpeaking ? "var(--accent)" : "var(--green)",
          }}
        />
        <span style={styles.speakerLabel}>
          {ariaIsSpeaking ? "Aria is speaking..." : "Your turn"}
        </span>
      </div>

      {/* Muted warning banner */}
      {isMuted && (
        <div style={styles.mutedBanner}>
          Your microphone is muted. Aria cannot hear you.
        </div>
      )}

      {/* Mute button */}
      <button
        style={{
          ...styles.muteBtn,
          ...(isMuted ? styles.muteBtnActive : {}),
        }}
        onClick={onToggleMute}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
      >
        {isMuted ? (
          <MicOffIcon />
        ) : (
          <MicIcon />
        )}
        <span>{isMuted ? "Unmute" : "Mute"}</span>
      </button>

      <p style={styles.hint}>
        Answer naturally. Aria will move to the next question when you are done.
      </p>
    </div>
  );
}

function CompletedState({ candidateName }: { candidateName: string }) {
  return (
    <div style={{ ...styles.section, alignItems: "center", textAlign: "center" }}>
      <div style={styles.checkCircle}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 style={styles.heading}>Thank you, {candidateName}</h1>
      <p style={styles.body}>
        Your interview is complete. Our team will review your responses and get
        back to you within 48 hours.
      </p>
      <p style={styles.muted}>You can close this window.</p>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    minHeight: "-webkit-fill-available", // Safari iOS: full viewport height
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    // Extra bottom padding on mobile to clear iOS home indicator
    paddingBottom: "max(24px, env(safe-area-inset-bottom))",
    background: "var(--bg)",
    // Prevent rubber-band scroll revealing white background on iOS
    overscrollBehavior: "none",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    // Reduce padding on small screens
    padding: "clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  brandDot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--accent)",
  },
  brandName: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-secondary)",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    color: "var(--text-primary)",
    lineHeight: 1.3,
  },
  subheading: {
    fontSize: 14,
    color: "var(--accent)",
    fontWeight: 500,
  },
  divider: {
    height: 1,
    background: "var(--border)",
    margin: "4px 0",
  },
  body: {
    fontSize: 15,
    color: "var(--text-secondary)",
    lineHeight: 1.7,
  },
  checklist: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingLeft: 0,
    fontSize: 14,
    color: "var(--text-secondary)",
  },
  primaryBtn: {
    marginTop: 8,
    padding: "14px 28px",
    background: "var(--accent)",
    color: "#000",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "0.02em",
    transition: "opacity 0.15s",
    alignSelf: "flex-start",
  },
  errorText: {
    fontSize: 13,
    color: "var(--red)",
    padding: "10px 14px",
    background: "rgba(239,68,68,0.1)",
    borderRadius: 8,
    border: "1px solid rgba(239,68,68,0.25)",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid var(--border)",
    borderTop: "3px solid var(--accent)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  metaLabel: {
    fontSize: 13,
    color: "var(--text-secondary)",
  },
  metaSep: {
    color: "var(--text-muted)",
  },
  timer: {
    fontFamily: "var(--font-mono)",
    fontSize: 14,
    color: "var(--accent)",
    fontWeight: 600,
  },
  visualizerWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    padding: "16px 0",
  },
  speakerIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  speakerDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    transition: "background 0.3s",
  },
  speakerLabel: {
    fontSize: 13,
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  muteBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-primary)",
    fontSize: 14,
    fontWeight: 500,
    transition: "all 0.15s",
  },
  muteBtnActive: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "var(--red)",
  },
  hint: {
    fontSize: 12,
    color: "var(--text-muted)",
    textAlign: "center",
    lineHeight: 1.5,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "rgba(34,197,94,0.12)",
    border: "2px solid var(--green)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--green)",
    marginBottom: 8,
  },
  muted: {
    fontSize: 13,
    color: "var(--text-muted)",
    marginTop: 8,
  },
  mutedBanner: {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.35)",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--red)",
    textAlign: "center" as const,
  },
};
