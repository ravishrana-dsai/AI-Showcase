"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";

function [Company]Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/[Company] logo purple.png`}
      alt="[Company] AI"
      className={className}
    />
  );
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left dark panel */}
      <div className="hidden lg:flex lg:w-[44%] flex-col items-center justify-center relative overflow-hidden bg-[#09000f]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-fuchsia-700/25 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-700/25 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          <[Company]Logo className="w-36 h-auto mb-6 drop-shadow-[0_0_40px_rgba(168,85,247,0.5)]" />
          <h1 className="text-3xl font-black text-white mb-3 tracking-tight">[Company] AI</h1>
          <p className="text-sm text-purple-300 max-w-xs leading-relaxed">
            Applicant Tracking System for [Company] AI
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 relative bg-background">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <[Company]Logo className="mx-auto w-16 h-auto mb-3" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Access Restricted</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Account creation is by invitation only.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">How to get access</p>
            <p>
              Contact your [Company] AI administrator to receive your login credentials directly.
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
