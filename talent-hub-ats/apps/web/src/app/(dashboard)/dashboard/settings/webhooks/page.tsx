"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Webhook, Loader2, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface WebhookItem {
  id: string;
  url: string;
  events: string;
  secret: string;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  "candidate.created", "candidate.updated", "candidate.archived",
  "application.created", "application.stage_changed", "application.rejected", "application.hired",
  "interview.scheduled", "interview.completed",
  "offer.created", "offer.accepted", "offer.declined",
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(getApiUrl("/api/v1/webhooks")).then((r) => r.json()).then((d) => setWebhooks(d.webhooks ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || selectedEvents.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch(getApiUrl("/api/v1/webhooks"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim(), events: selectedEvents }) });
      const data = await res.json();
      if (data.webhook) {
        setNewSecret(data.webhook.secret);
        setWebhooks((prev) => [data.webhook, ...prev]);
        setUrl("");
        setSelectedEvents([]);
      }
    } catch {} finally { setCreating(false); }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" />Back to Settings</Link>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Webhooks</h1><p className="text-muted-foreground mt-1">Receive real-time event notifications</p></div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"><Plus className="w-4 h-4" />Add Webhook</button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-card rounded-xl border p-5 space-y-4">
          <div><label className="block text-sm font-medium mb-1.5">Endpoint URL</label><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhook" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required /></div>
          <div>
            <label className="block text-sm font-medium mb-2">Events</label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={selectedEvents.includes(event)} onChange={() => toggleEvent(event)} className="rounded" />
                  {event}
                </label>
              ))}
            </div>
          </div>
          {newSecret && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm font-medium text-green-800 mb-2">Webhook created! Save the signing secret:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white px-3 py-2 rounded border font-mono break-all">{newSecret}</code>
                <button type="button" onClick={() => { navigator.clipboard.writeText(newSecret); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="p-2 rounded-lg hover:bg-green-100">{copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}</button>
              </div>
            </div>
          )}
          <button type="submit" disabled={creating || selectedEvents.length === 0} className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50")}>{creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : "Create Webhook"}</button>
        </form>
      )}

      <div className="bg-card rounded-xl border">
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div> : webhooks.length === 0 ? (
          <div className="p-12 text-center"><Webhook className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-medium">No webhooks</h3><p className="text-muted-foreground mt-1">Add a webhook to receive event notifications.</p></div>
        ) : (
          <div className="divide-y">
            {webhooks.map((wh) => {
              const events = (() => { try { return JSON.parse(wh.events); } catch { return []; } })();
              return (
                <div key={wh.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm font-mono">{wh.url}</p>
                      <div className="flex flex-wrap gap-1 mt-2">{events.map((e: string) => <span key={e} className="text-xs bg-muted px-2 py-0.5 rounded-full">{e}</span>)}</div>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", wh.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>{wh.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
