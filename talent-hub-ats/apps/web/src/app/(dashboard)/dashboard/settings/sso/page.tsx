import { requireAuth } from "@/lib/get-session";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";
import { SsoConfigForm } from "@/components/settings/sso-config-form";

export default async function SsoPage() {
  const user = await requireAuth();

  if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-gray-500">You do not have permission to manage SSO settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/settings" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SSO / Google Sign-In</h1>
          <p className="text-sm text-gray-500 mt-1">
            Allow team members to sign in automatically with their Google Workspace accounts.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 text-blue-600 rounded-lg p-2">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Google Workspace SSO</h2>
            <p className="text-sm text-gray-500">Domain-based auto-provisioning for your team.</p>
          </div>
        </div>

        <SsoConfigForm />
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">How it works</p>
        <ul className="space-y-1 list-disc list-inside text-blue-600">
          <li>Set your Google Workspace domain (e.g. company.com).</li>
          <li>Enable SSO above.</li>
          <li>Users at that domain can now click "Sign in with Google" and are automatically added to your workspace.</li>
          <li>Users with non-matching domains still require an invitation.</li>
        </ul>
      </div>
    </div>
  );
}
