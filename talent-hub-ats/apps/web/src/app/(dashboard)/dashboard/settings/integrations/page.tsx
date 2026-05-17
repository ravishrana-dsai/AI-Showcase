import { requireAuth } from "@/lib/get-session";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CalendarIntegrationCard } from "@/components/settings/calendar-integration-card";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAuth();
  const params = await searchParams;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/settings" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">Connect external services to streamline your workflow.</p>
        </div>
      </div>

      {params.success === "calendar_connected" && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
          Google Calendar connected successfully. Interview events will now be created automatically.
        </div>
      )}
      {params.error === "calendar_denied" && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Google Calendar connection was cancelled.
        </div>
      )}
      {params.error === "calendar_failed" && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to connect Google Calendar. Please try again.
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Calendar</h2>
        <CalendarIntegrationCard />
      </div>
    </div>
  );
}
