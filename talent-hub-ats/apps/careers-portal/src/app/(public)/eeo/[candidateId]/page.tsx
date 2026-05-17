export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { EeoForm } from "./eeo-form";
import { fetchCandidateForEeo } from "@/lib/hiring-portal";

interface PageProps {
  params: Promise<{ candidateId: string }>;
}

export default async function EeoPage({ params }: PageProps) {
  const { candidateId } = await params;

  const candidate = await fetchCandidateForEeo(candidateId);

  if (!candidate) notFound();

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="rounded-xl border bg-card p-8 shadow-sm space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Equal Opportunity Survey
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This survey is entirely voluntary and confidential. The data is
              used only in aggregate form to ensure equal opportunity in our
              hiring process, and is never shared with hiring managers or used
              in hiring decisions.
            </p>
          </div>

          {candidate.hasEeoResponse ? (
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-700 dark:text-green-400">
              Your EEO response has already been recorded. Thank you.
            </div>
          ) : (
            <EeoForm candidateId={candidate.id} />
          )}
        </div>
      </div>
    </div>
  );
}
