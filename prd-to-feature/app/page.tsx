"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PRDInput, type SourceFile } from "@/components/PRDInput";
import { ResultView } from "@/components/ResultView";

const MAX_SCREENSHOTS = 3;
const SCREENSHOT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Read a File as a base64 data URL */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export type GenerateResult = {
  design: string;
  files: { path: string; content: string; isModified?: boolean }[];
  preview: string;
  mockups: string[];
} | null;

type Mode = "idea" | "prd";

const PIPELINE_STEPS = [
  { label: "Parsing PRD", description: "Extracting requirements and goals" },
  { label: "Generating Design Spec", description: "Creating layouts and component map" },
  { label: "Generating Mockups", description: "Rendering visual UI mockups" },
  { label: "Building Preview", description: "Compiling interactive HTML preview" },
  { label: "Writing Code", description: "Generating Next.js + TypeScript files" },
];

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <svg className="w-4.5 h-4.5 w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
    </button>
  );
}

export default function Home() {
  const [result, setResult] = useState<GenerateResult>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [mode, setMode] = useState<Mode>("idea");

  // Step 0 state
  const [idea, setIdea] = useState("");
  const [generatedPrd, setGeneratedPrd] = useState<string | null>(null);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]); // base64 data URLs
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const handleScreenshotUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_SCREENSHOTS - screenshots.length;
    const toAdd = files.slice(0, remaining);
    const dataUrls = await Promise.all(toAdd.map(readFileAsDataUrl));
    setScreenshots((prev) => [...prev, ...dataUrls].slice(0, MAX_SCREENSHOTS));
    e.target.value = "";
  }, [screenshots.length]);

  const removeScreenshot = useCallback((idx: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleIdeaToPrd = async () => {
    if (!idea.trim()) return;
    setIdeaLoading(true);
    setIdeaError(null);
    setGeneratedPrd(null);
    try {
      const res = await fetch("/api/idea-to-prd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim(), ...(screenshots.length > 0 ? { screenshots } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to generate PRD");
      setGeneratedPrd(data.prd ?? "");
      // Auto-switch to PRD tab so user can review, add source files, then generate
      setMode("prd");
    } catch (e) {
      setIdeaError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setIdeaLoading(false);
    }
  };

  const handleGenerate = async (prd: string, sourceFiles: SourceFile[]) => {
    setError(null);
    setResult(null);
    setLoading(true);
    setActiveStep(0);

    // Approximate real durations per stage (ms). These drive the UI step indicator
    // and are intentionally conservative so the UI doesn't race ahead of the server.
    // Parse: ~10s, Design: ~20s, Mockups: ~40s, Preview: ~25s, Code: ~40s
    const stepDurations = [10000, 20000, 40000, 25000, 40000];
    let stepIndex = 0;
    const stepTimers: ReturnType<typeof setTimeout>[] = [];

    const advanceStep = () => {
      if (stepIndex < PIPELINE_STEPS.length - 1) {
        stepIndex++;
        setActiveStep(stepIndex);
        const timer = setTimeout(advanceStep, stepDurations[stepIndex] ?? 15000);
        stepTimers.push(timer);
      }
    };
    const firstTimer = setTimeout(advanceStep, stepDurations[0]);
    stepTimers.push(firstTimer);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prd,
          ...(sourceFiles.length > 0 ? { sourceFiles } : {}),
          ...(screenshots.length > 0 ? { screenshots } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data && typeof data.error === "string" ? data.error : null) || res.statusText || "Generate failed");
      }
      setResult({
        design: data.design ?? "",
        files: data.files ?? [],
        preview: data.preview ?? "",
        mockups: data.mockups ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      stepTimers.forEach(clearTimeout);
      setLoading(false);
      setActiveStep(0);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setGeneratedPrd(null);
    setIdea("");
    setScreenshots([]);
    setMode("idea");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Idea to PRD to Feature</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:block">Gemini 2.0</span>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="flex-1 py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Hero — only on initial screen */}
          {!result && !loading && (
            <div className="text-center pt-4 pb-2">
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400 text-xs font-semibold tracking-wide uppercase">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                AI-Powered
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                From idea to{" "}
                <span className="text-indigo-600 dark:text-indigo-400">working feature</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-lg mx-auto text-base leading-relaxed">
                Describe your idea or paste a PRD. Get a design spec, UI mockups, live interactive preview, and production-ready Next.js code — in minutes.
              </p>

              {/* Pipeline steps */}
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-6 gap-3 max-w-3xl mx-auto text-left">
                {[
                  { icon: "💡", label: "Idea", sub: "Plain English" },
                  { icon: "📋", label: "PRD", sub: "Auto-generated" },
                  { icon: "📐", label: "Design Spec", sub: "Layouts" },
                  { icon: "🎨", label: "Mockups", sub: "AI visuals" },
                  { icon: "👁️", label: "Preview", sub: "Interactive" },
                  { icon: "⚡", label: "Code", sub: "Next.js + TS" },
                ].map((step, i) => (
                  <div key={i} className="relative flex flex-col items-center text-center p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
                    {i < 5 && (
                      <div className="hidden sm:block absolute -right-1.5 top-1/2 -translate-y-1/2 z-10">
                        <svg className="w-3 h-3 text-slate-300 dark:text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <span className="text-xl mb-1">{step.icon}</span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{step.label}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{step.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result header */}
          {result && (
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Generation complete</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {result.files.length} file{result.files.length !== 1 ? "s" : ""} generated
                  {result.mockups.length > 0 && ` · ${result.mockups.length} mockup${result.mockups.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Start over
              </button>
            </div>
          )}

          {/* Input area — only when no result */}
          {!result && !loading && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md shadow-slate-200/50 dark:shadow-slate-900/50 overflow-hidden">
              {/* Mode tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode("idea")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${
                    mode === "idea"
                      ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <span className="text-base">💡</span>
                  <span>I have an idea</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${mode === "idea" ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500"}`}>Step 0</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("prd")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${
                    mode === "prd"
                      ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <span className="text-base">📋</span>
                  <span>I have a PRD</span>
                </button>
              </div>

              <div className="p-6 sm:p-8">
                {/* Step 0: Idea mode */}
                {mode === "idea" && (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Describe your feature idea
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        Write a few sentences about what you want to build. We&apos;ll turn it into a full PRD, then generate everything.
                      </p>
                      <div className="relative">
                        <textarea
                          value={idea}
                          onChange={(e) => setIdea(e.target.value)}
                          placeholder={"e.g. I want a task management sidebar for our project dashboard. Users should be able to add tasks with a title, assign them to team members, set due dates, and mark them as done. Project managers need to see all tasks at a glance."}
                          className="w-full h-44 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-slate-800 dark:text-slate-200 text-sm leading-relaxed placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 dark:focus:border-indigo-500 transition-shadow resize-none"
                          disabled={ideaLoading}
                        />
                        {idea.length > 0 && (
                          <button
                            type="button"
                            onClick={() => { setIdea(""); setGeneratedPrd(null); }}
                            className="absolute top-3 right-3 p-1 rounded-md text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Screenshot attachments */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          Attach screenshots
                          <span className="font-normal text-slate-400">(optional — existing UI for style context)</span>
                        </span>
                        {screenshots.length < MAX_SCREENSHOTS && (
                          <button
                            type="button"
                            onClick={() => screenshotInputRef.current?.click()}
                            disabled={ideaLoading}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-medium disabled:opacity-40 transition-colors"
                          >
                            + Add image
                          </button>
                        )}
                      </div>
                      <input
                        ref={screenshotInputRef}
                        type="file"
                        accept={SCREENSHOT_ACCEPT}
                        multiple
                        onChange={handleScreenshotUpload}
                        className="hidden"
                      />
                      {screenshots.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {screenshots.map((src, idx) => (
                            <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeScreenshot(idx)}
                                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          {screenshots.length < MAX_SCREENSHOTS && (
                            <button
                              type="button"
                              onClick={() => screenshotInputRef.current?.click()}
                              disabled={ideaLoading}
                              className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors disabled:opacity-40"
                              title="Add another screenshot"
                            >
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => screenshotInputRef.current?.click()}
                          disabled={ideaLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition-colors disabled:opacity-40"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                          Upload PNG, JPG, or WebP · up to {MAX_SCREENSHOTS} images
                        </button>
                      )}
                    </div>

                    {ideaError && (
                      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        {ideaError}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleIdeaToPrd}
                        disabled={ideaLoading || !idea.trim()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 hover:shadow-lg transition-all text-sm"
                      >
                        {ideaLoading ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Writing PRD…
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            Generate PRD
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* PRD mode */}
                {mode === "prd" && (
                  <PRDInput onGenerate={handleGenerate} disabled={loading} initialPrd={generatedPrd ?? undefined} />
                )}
              </div>
            </section>
          )}

          {/* Loading state */}
          {loading && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md p-8">
              <div className="max-w-md mx-auto">
                <div className="text-center mb-8">
                  <div className="relative inline-flex mb-4">
                    <div className="w-14 h-14 rounded-full border-4 border-indigo-100 dark:border-indigo-900/50" />
                    <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-200">Generating your feature</p>
                  <p className="text-sm text-slate-400 mt-1">This typically takes 2–3 minutes</p>
                </div>

                <div className="space-y-2">
                  {PIPELINE_STEPS.map((step, i) => {
                    const isDone = i < activeStep;
                    const isActive = i === activeStep;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${
                          isActive ? "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900"
                            : isDone ? "opacity-60" : "opacity-30"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                          isDone ? "bg-green-500" : isActive ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                        }`}>
                          {isDone ? (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : isActive ? (
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${isActive ? "text-indigo-800 dark:text-indigo-300" : isDone ? "text-slate-600 dark:text-slate-400" : "text-slate-400 dark:text-slate-600"}`}>
                            {step.label}
                          </p>
                          {isActive && <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">{step.description}</p>}
                        </div>
                        {isActive && (
                          <div className="ml-auto shrink-0 flex gap-1">
                            {[0, 1, 2].map((dot) => (
                              <div key={dot} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${dot * 0.15}s` }} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-5 py-4 shadow-sm flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">Generation failed</p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">{error}</p>
              </div>
              <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Result */}
          {result && (
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-lg shadow-slate-300/30 dark:shadow-slate-900/50 overflow-hidden bg-white dark:bg-slate-900">
              <ResultView design={result.design} files={result.files} preview={result.preview} mockups={result.mockups} />
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/70 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 mt-auto">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <p className="text-xs text-slate-400">Idea to PRD to Feature · AI-powered feature generation</p>
          <p className="text-xs text-slate-400">Built with Gemini 2.0 Flash</p>
        </div>
      </footer>
    </div>
  );
}
