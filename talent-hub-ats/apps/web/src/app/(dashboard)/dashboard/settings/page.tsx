import { requirePermission } from "@/lib/get-session";
import SettingsTabs from "@/components/settings/settings-tabs";

export default async function SettingsPage() {
  await requirePermission("settings.manage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your [Company] AI workspace
        </p>
      </div>

      <SettingsTabs />
    </div>
  );
}
