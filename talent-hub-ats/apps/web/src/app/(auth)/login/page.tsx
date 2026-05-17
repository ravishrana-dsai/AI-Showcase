"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Wifi, Copy, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { getApiUrl } from "@/lib/api";

// ─── [Company] Logo — hero size (left panel) ────────────────────────────────
function [Company]Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/[Company] logo purple.png`}
      alt="[Company]"
      className={className}
    />
  );
}

// ─── Small badge logo (right panel header + mobile) ──────────────────────────
function LogoBadge() {
  return (
    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden shadow-lg shadow-violet-500/30 bg-[#09000f]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/[Company] logo purple.png`}
        alt="[Company]"
        className="h-10 w-10 object-contain"
      />
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

// ─── Demo accounts data ───────────────────────────────────────────────────────
type DemoAccount = { name: string; role: string; email: string };

const demoGroups: { label: string; color: string; accounts: DemoAccount[] }[] = [
  {
    label: "Recruiter",
    color: "text-violet-600 dark:text-violet-400",
    accounts: [
      { name: "Bhanvi Kumar", role: "Recruiter", email: "recruiter@company.com" },
    ],
  },
  {
    label: "Hiring Manager",
    color: "text-fuchsia-600 dark:text-fuchsia-400",
    accounts: [
      { name: "Arjun Mehta", role: "HM", email: "manager@company.com" },
    ],
  },
  {
    label: "Interviewer",
    color: "text-purple-600 dark:text-purple-400",
    accounts: [
      { name: "Neha Gupta", role: "IV", email: "interviewer@company.com" },
    ],
  },
];

const DEMO_PASSWORD = "Sports@123";

// ─── Main form ────────────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const error = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    error === "CredentialsSignin" ? "Invalid email or password." : ""
  );
  const [networkUrls, setNetworkUrls] = useState<string[]>([]);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      fetch(getApiUrl("/api/dev/network-url"))
        .then((r) => r.json())
        .then((d) => setNetworkUrls(d.urls || []))
        .catch(() => {});
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    try {
      const result = await signIn("credentials", { email, password, redirect: false, callbackUrl });
      if (result?.error) {
        setErrorMessage("Invalid email or password. Please try again.");
      } else if (result?.ok) {
        // Use path only to stay on the same host (works for both localhost and network IP).
        const path =
          typeof window !== "undefined"
            ? new URL(result.url || callbackUrl, window.location.origin).pathname
            : callbackUrl;
        router.push(path);
      }
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(DEMO_PASSWORD);
    setErrorMessage("");
    setDemoOpen(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left hero panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[44%] flex-col items-center justify-center relative overflow-hidden bg-[#09000f]">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-fuchsia-700/25 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-700/25 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-purple-600/10 blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          <[Company]Logo className="w-36 h-auto mb-6 drop-shadow-[0_0_40px_rgba(168,85,247,0.5)]" />
          <h1 className="text-3xl font-black text-white mb-3 tracking-tight">
            [Company] AI
          </h1>
          <p className="text-sm text-purple-300 max-w-xs leading-relaxed">
            The hiring platform built for India's fastest-growing AI company.
            Manage your full pipeline from sourcing to offer.
          </p>
        </div>

        {/* Bottom theme toggle */}
        <div className="absolute bottom-6 right-6 opacity-60 hover:opacity-100 transition-opacity">
          <ThemeToggle />
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col">
        {/* Top bar — mobile theme toggle + logo */}
        <div className="flex items-center justify-between px-6 py-4 lg:px-8 lg:hidden">
          <div className="flex items-center gap-2">
            <LogoBadge />
            <span className="font-bold text-base">[Company] AI</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="hidden lg:flex justify-end px-8 py-4">
          <ThemeToggle />
        </div>

        {/* Form area */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-12 lg:px-16">
          <div className="w-full max-w-[400px]">

            {/* Heading */}
            <div className="mb-8">
              <div className="mb-4 hidden lg:block">
                <LogoBadge />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to your [Company] AI account
              </p>
            </div>

            {/* Error */}
            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {errorMessage}
              </div>
            )}

            {/* Sign-in form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-1 h-11 w-full rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition-all hover:from-fuchsia-500 hover:to-violet-500 hover:shadow-violet-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Google OAuth */}
            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
              <>
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wider">
                    <span className="bg-background px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signIn("google", { callbackUrl })}
                  className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>
              </>
            )}

            {/* Demo accounts — collapsible */}
            <div className="mt-6 rounded-xl border border-border/70 overflow-hidden">
              <button
                type="button"
                onClick={() => setDemoOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                <span>Demo accounts</span>
                <span className="flex items-center gap-1 text-[10px] normal-case font-normal tracking-normal text-muted-foreground/70">
                  <span className="font-mono">{DEMO_PASSWORD}</span>
                  {demoOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </span>
              </button>

              {demoOpen && (
                <div className="border-t border-border/50 px-4 py-3 space-y-4 bg-muted/20">
                  {demoGroups.map(({ label, color, accounts }) => (
                    <div key={label}>
                      <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${color}`}>
                        {label}
                      </p>
                      <div className={accounts.length > 2 ? "grid grid-cols-2 gap-1.5" : "space-y-1.5"}>
                        {accounts.map((acc) => (
                          <button
                            key={acc.email}
                            type="button"
                            onClick={() => fillDemo(acc)}
                            className="flex flex-col gap-0.5 rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 text-left text-xs transition-all hover:border-violet-400/60 hover:bg-violet-50/10 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
                          >
                            <span className="font-medium text-foreground leading-tight">{acc.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground leading-tight truncate">
                              {acc.email.replace("@company.com", "")}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create account link */}

            {/* Network URLs (dev only) */}
            {networkUrls.length > 0 && (
              <div className="mt-4 rounded-xl border border-border/70 px-4 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Wifi className="h-3.5 w-3.5" />
                  Access on same WiFi
                </p>
                {networkUrls.map((url) => (
                  <div key={url} className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 mt-1.5">
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="flex-1 truncate font-mono text-xs text-violet-600 dark:text-violet-400 hover:underline">
                      {url}
                    </a>
                    <button type="button" onClick={() => navigator.clipboard.writeText(url)}
                            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Copy">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
