import { requirePermission } from "@/lib/get-session";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOrgHideDemoData } from "@/lib/demo-data";
import { DemoDataSwitch } from "@/components/dashboard/demo-data-switch";

export default async function DemoDataSettingsPage() {
  const user = await requirePermission("settings.manage");
  const hideDemo = await getOrgHideDemoData(user.organizationId);

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Demo Data</h1>
        <p className="text-muted-foreground mt-1">
          When &quot;Demo data&quot; is hidden, all sample data added by the seed script (jobs, candidates, interviews, offers, requisitions) is excluded from lists and counts. Only real data is shown. Recruiters and admins can also toggle this from the dashboard.
        </p>
      </div>
      <div className="bg-card rounded-xl border p-5">
        <DemoDataSwitch initialHideDemo={hideDemo} />
      </div>
    </div>
  );
}
