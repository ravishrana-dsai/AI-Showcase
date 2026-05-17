"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Key, Copy, Check, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(getApiUrl("/api/settings/api-keys")).then((r) => r.json()).then((d) => setKeys(d.keys ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(getApiUrl("/api/settings/api-keys"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      const data = await res.json();
      if (data.apiKey) {
        setNewKey(data.apiKey.fullKey);
        setKeys((prev) => [{ ...data.apiKey, key: data.apiKey.key }, ...prev]);
        setName("");
      }
    } catch {} finally { setCreating(false); }
  };

  const copyKey = () => {
    if (newKey) { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" />Back to Settings</Link>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">API Keys</h1><p className="text-muted-foreground mt-1">Manage API keys for external integrations</p></div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"><Plus className="w-4 h-4" />Create Key</button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-card rounded-xl border p-5 space-y-4">
          <div><label className="block text-sm font-medium mb-1.5">Key Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production API" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required /></div>
          {newKey && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm font-medium text-green-800 mb-2">API Key Created! Copy it now — it won't be shown again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white px-3 py-2 rounded border font-mono break-all">{newKey}</code>
                <button type="button" onClick={copyKey} className="p-2 rounded-lg hover:bg-green-100 transition-colors">{copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}</button>
              </div>
            </div>
          )}
          <button type="submit" disabled={creating} className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50")}>{creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : "Generate Key"}</button>
        </form>
      )}

      <div className="bg-card rounded-xl border">
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div> : keys.length === 0 ? (
          <div className="p-12 text-center"><Key className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-medium">No API keys</h3><p className="text-muted-foreground mt-1">Create an API key to integrate with external systems.</p></div>
        ) : (
          <div className="divide-y">
            {keys.map((k) => (
              <div key={k.id} className="p-5 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{k.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Key: {k.key} &bull; Created {formatDate(k.createdAt)}{k.lastUsedAt ? ` &bull; Last used ${formatDate(k.lastUsedAt)}` : ""}</p>
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", k.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>{k.isActive ? "Active" : "Inactive"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
