export const dynamic = "force-dynamic";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { JobsDepartmentList } from "@/components/careers/jobs-department-list";
import { fetchAllOpenJobs } from "@/lib/hiring-portal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open roles",
  description: "Browse published open positions from our career sites.",
};

export default async function CareersPortalHome() {
  const jobs = await fetchAllOpenJobs();

  const normalizedJobs = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    department: job.department?.name ?? "General",
    location: job.location?.name ?? null,
    employmentType: job.employmentType ?? null,
    orgSlug: job.organization?.slug ?? null,
    orgName: job.organization?.name ?? null,
  }));

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <span className="text-sm font-semibold tracking-tight text-white">Careers</span>
          <Link
            href="/jobs"
            className="text-xs font-medium text-white/50 transition hover:text-white/80"
          >
            Marketing careers page
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-400">
            Open positions
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            All open roles
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/50">
            Live listings from the ATS — same jobs recruiters publish. Select a role to view details
            and apply.
          </p>
        </div>

        {normalizedJobs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-500/20">
              <Sparkles className="h-10 w-10 text-violet-400" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-white">No open positions right now</h2>
            <p className="mx-auto max-w-md text-sm text-white/50">
              When jobs are published in the ATS, they will appear here automatically.
            </p>
          </div>
        ) : (
          <JobsDepartmentList jobs={normalizedJobs} />
        )}
      </main>
    </div>
  );
}
