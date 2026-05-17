"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle, AlertCircle, Plus, X } from "lucide-react";
import { getApiUrl } from "@/lib/api";

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;

interface SsoConfig {
  ssoEnabled: boolean;
  googleDomains: string[];
  ssoDefaultRole: string;
}

export function SsoConfigForm() {
  const [config, setConfig] = useState<SsoConfig>({
    ssoEnabled: false,
    googleDomains: [],
    ssoDefaultRole: "RECRUITER",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [inputError, setInputError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(getApiUrl("/api/settings/sso"))
      .then((r) => r.json())
      .then((data) =>
        setConfig({
          ssoEnabled: data.ssoEnabled ?? false,
          googleDomains: data.googleDomains ?? [],
          ssoDefaultRole: data.ssoDefaultRole ?? "RECRUITER",
        })
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function addDomain() {
    const raw = domainInput.trim().toLowerCase();
    if (!raw) return;
    if (!DOMAIN_RE.test(raw)) {
      setInputError("Invalid domain format. Use something like company.com");
      return;
    }
    if (config.googleDomains.includes(raw)) {
      setInputError("This domain is already in the list.");
      return;
    }
    setConfig((c) => ({ ...c, googleDomains: [...c.googleDomains, raw] }));
    setDomainInput("");
    setInputError("");
    inputRef.current?.focus();
  }

  function removeDomain(domain: string) {
    setConfig((c) => ({ ...c, googleDomains: c.googleDomains.filter((d) => d !== domain) }));
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addDomain();
    } else if (e.key === "Backspace" && !domainInput && config.googleDomains.length > 0) {
      // Remove last domain on backspace when input is empty
      setConfig((c) => ({ ...c, googleDomains: c.googleDomains.slice(0, -1) }));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // Commit any pending input before saving
    if (domainInput.trim()) addDomain();
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(getApiUrl("/api/settings/sso"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssoEnabled: config.ssoEnabled,
          googleDomains: config.googleDomains,
          ssoDefaultRole: config.ssoDefaultRole,
        }),
      });
      // Guard against non-JSON responses (e.g. 500 HTML error pages)
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        setResult({ ok: false, message: `Server error (${res.status}). Please try again.` });
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: "SSO settings saved." });
        setConfig((c) => ({
          ...c,
          googleDomains: data.googleDomains ?? c.googleDomains,
          ssoDefaultRole: data.ssoDefaultRole ?? c.ssoDefaultRole,
        }));
      } else {
        setResult({ ok: false, message: data.error ?? "Failed to save settings." });
      }
    } catch (err) {
      console.error("[SSO] Save error:", err);
      setResult({ ok: false, message: "Could not reach the server. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Enable toggle */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-medium">Enable Google SSO</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Users signing in with Google accounts on your allowed domains will be automatically
            added to your workspace.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.ssoEnabled}
          onClick={() => setConfig((c) => ({ ...c, ssoEnabled: !c.ssoEnabled }))}
          className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            config.ssoEnabled ? "bg-violet-600" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              config.ssoEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {config.ssoEnabled && (
        <>
          {/* Domain list */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Allowed Google Domains
            </label>

            {/* Tag container + input */}
            <div
              className="flex flex-wrap gap-1.5 min-h-[42px] w-full rounded-lg border border-input bg-background px-2.5 py-2 cursor-text focus-within:ring-2 focus-within:ring-violet-500 focus-within:ring-offset-1"
              onClick={() => inputRef.current?.focus()}
            >
              {config.googleDomains.map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300 px-2 py-0.5 text-sm font-medium"
                >
                  {domain}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeDomain(domain); }}
                    className="rounded hover:bg-violet-200 dark:hover:bg-violet-800 p-0.5 transition-colors"
                    aria-label={`Remove ${domain}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              <input
                ref={inputRef}
                type="text"
                value={domainInput}
                onChange={(e) => { setDomainInput(e.target.value); setInputError(""); }}
                onKeyDown={handleInputKeyDown}
                onBlur={addDomain}
                placeholder={config.googleDomains.length === 0 ? "company.com" : "Add another…"}
                className="flex-1 min-w-[140px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {inputError && (
              <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {inputError}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-1.5">
              Type a domain and press <kbd className="rounded border px-1 py-0.5 text-[10px] font-mono bg-muted">Enter</kbd> or <kbd className="rounded border px-1 py-0.5 text-[10px] font-mono bg-muted">,</kbd> to add it.
              Backspace removes the last one. You can add as many domains as needed.
            </p>

            {config.googleDomains.length > 0 && (
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{config.googleDomains.length}</span> domain{config.googleDomains.length !== 1 ? "s" : ""} configured.
                Any Google account with these domains will be auto-provisioned on first sign-in.
              </div>
            )}
          </div>

          {/* Default role */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Default Role for New SSO Users
            </label>
            <select
              value={config.ssoDefaultRole}
              onChange={(e) => setConfig((c) => ({ ...c, ssoDefaultRole: e.target.value }))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="INTERVIEWER">Interviewer</option>
              <option value="HIRING_MANAGER">Hiring Manager</option>
              <option value="RECRUITER">Recruiter</option>
              <option value="SUB_RECRUITER">Sub-Recruiter</option>
              <option value="ADMIN">Admin</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1.5">
              Auto-provisioned users will receive this role. You can change individual roles from Team settings.
            </p>
          </div>
        </>
      )}

      {/* Save feedback */}
      {result && (
        <div
          className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
            result.ok
              ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
              : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"
          }`}
        >
          {result.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? "Saving…" : "Save SSO Settings"}
      </button>
    </form>
  );
}
