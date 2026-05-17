"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token || !email) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-destructive">Invalid or missing reset link.</p>
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 mx-auto">
          <CheckCircle2 className="h-7 w-7 text-green-500" />
        </div>
        <div>
          <p className="font-medium">Password updated!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Redirecting to login…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Set new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a new password for <strong>{email}</strong>.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">New password</label>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-lg border bg-muted/50 px-3 pr-10 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Confirm password</label>
          <input
            type={showPassword ? "text" : "password"}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            className="mt-1 w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? "Resetting…" : "Reset password"}
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
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-8 shadow-sm space-y-6">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
