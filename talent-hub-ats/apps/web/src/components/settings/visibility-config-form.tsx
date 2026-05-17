"use client";

import { useState } from "react";
import { Loader2, CheckCircle, AlertCircle, Lock } from "lucide-react";
import type { VisibilityField } from "@/lib/visibility";
import { DEFAULT_VISIBILITY } from "@/lib/visibility";
import { getApiUrl } from "@/lib/api";

const FIELD_LABELS: Record<VisibilityField, string> = {
  resume: "Resume / CV",
  contactInfo: "Contact Info (email, phone)",
  expectedCtc: "Expected CTC",
  noticePeriod: "Notice Period",
  linkedinUrl: "LinkedIn URL",
  source: "Source / Source Detail",
  skills: "Skills",
  summary: "Summary",
};

const CONFIGURABLE_ROLES = [
  { key: "RECRUITER", label: "Recruiter" },
  { key: "HIRING_MANAGER", label: "Hiring Manager" },
  { key: "INTERVIEWER", label: "Interviewer" },
  { key: "SUB_RECRUITER", label: "Sub-Recruiter" },
] as const;

type RoleKey = (typeof CONFIGURABLE_ROLES)[number]["key"];

type VisibilityConfig = Record<VisibilityField, Record<string, boolean>>;

interface VisibilityConfigFormProps {
  initialConfig: VisibilityConfig;
  userRole: string;
}

function isAdminRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function isRoleEditable(userRole: string, columnKey: RoleKey): boolean {
  if (isAdminRole(userRole)) return true;
  // RECRUITER can only edit the SUB_RECRUITER column
  if (userRole === "RECRUITER") return columnKey === "SUB_RECRUITER";
  return false;
}

export function VisibilityConfigForm({ initialConfig, userRole }: VisibilityConfigFormProps) {
  const [config, setConfig] = useState<VisibilityConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function toggle(field: VisibilityField, role: RoleKey) {
    if (!isRoleEditable(userRole, role)) return;
    const current = config[field]?.[role] ?? DEFAULT_VISIBILITY[field]?.[role] ?? false;
    setConfig((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [role]: !current,
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(getApiUrl("/api/settings/visibility"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        setResult({ ok: false, message: `Server error (${res.status}). Please try again.` });
        return;
      }

      const data = await res.json();

      if (res.ok) {
        setConfig(data.visibilityConfig as VisibilityConfig);
        setResult({ ok: true, message: "Visibility settings saved." });
      } else {
        setResult({ ok: false, message: (data as { error?: string }).error ?? "Failed to save." });
      }
    } catch (err) {
      console.error("[Visibility] Save error:", err);
      setResult({ ok: false, message: "Could not reach the server. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  const fields = Object.keys(DEFAULT_VISIBILITY) as VisibilityField[];

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-3 pr-6 font-semibold text-muted-foreground uppercase tracking-wider text-xs min-w-[200px]">
                Field
              </th>
              {CONFIGURABLE_ROLES.map((role) => {
                const editable = isRoleEditable(userRole, role.key);
                return (
                  <th
                    key={role.key}
                    className="text-center py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      {role.label}
                      {!editable && <Lock className="h-3 w-3 opacity-50" />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {fields.map((field) => (
              <tr key={field} className="hover:bg-muted/30 transition-colors">
                <td className="py-4 pr-6">
                  <span className="font-medium">{FIELD_LABELS[field]}</span>
                </td>
                {CONFIGURABLE_ROLES.map((role) => {
                  const isOn = config[field]?.[role.key] ?? false;
                  const editable = isRoleEditable(userRole, role.key);
                  return (
                    <td key={role.key} className="py-4 px-4 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        aria-label={`Toggle ${FIELD_LABELS[field]} for ${role.label}`}
                        disabled={!editable}
                        onClick={() => toggle(field, role.key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          isOn ? "bg-violet-600" : "bg-muted-foreground/30"
                        } ${!editable ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            isOn ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Admins control visibility for Recruiters, Hiring Managers, and Interviewers. Recruiters control what Sub-Recruiters can see.
      </p>

      {result && (
        <div
          className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
            result.ok
              ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
              : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"
          }`}
        >
          {result.ok ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {result.message}
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? "Saving..." : "Save Visibility Settings"}
      </button>
    </div>
  );
}
