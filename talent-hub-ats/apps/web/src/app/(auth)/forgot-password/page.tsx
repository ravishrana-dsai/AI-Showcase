"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await res.json();
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-8 shadow-sm space-y-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 mx-auto">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Check your email</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  If <strong>{email}</strong> has an account, we&apos;ve sent a
                  password reset link. The link expires in 1 hour.
                </p>
              </div>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-semibold">Reset your password</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your email address and we&apos;ll send you a reset link.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative mt-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-lg border bg-muted/50 pl-9 pr-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
