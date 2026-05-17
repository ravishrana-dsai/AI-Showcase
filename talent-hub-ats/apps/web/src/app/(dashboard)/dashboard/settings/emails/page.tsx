"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Mail, Loader2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  createdAt: string;
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(getApiUrl("/api/email/templates")).then((r) => r.json()).then((d) => setTemplates(d.templates ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setName(""); setSubject(""); setBody(""); setCategory("");
    setShowCreate(false); setEditingId(null); setError(null);
  };

  const startEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setName(t.name);
    setSubject(t.subject);
    setBody(t.body);
    setCategory(t.category ?? "");
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(getApiUrl("/api/email/templates"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), subject: subject.trim(), body: body.trim(), category: category.trim() || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTemplates((prev) => [data.template, ...prev]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(getApiUrl(`/api/email/templates/${editingId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), subject: subject.trim(), body: body.trim(), category: category.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTemplates((prev) => prev.map((t) => (t.id === editingId ? data.template : t)));
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl(`/api/email/templates/${id}`), { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setDeleting(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" />Back to Settings</Link>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Email Templates</h1><p className="text-muted-foreground mt-1">Manage templates for candidate communication</p></div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"><Plus className="w-4 h-4" />New Template</button>
      </div>
      <p className="text-sm text-muted-foreground">Use <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{{candidateName}}"}</code> in subject/body to auto-replace with the candidate's name.</p>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-card rounded-xl border p-5 space-y-4">
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1.5">Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Interview Invite" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required /></div>
            <div><label className="block text-sm font-medium mb-1.5">Category</label><input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Interview, Rejection" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1.5">Subject</label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required /></div>
          <div><label className="block text-sm font-medium mb-1.5">Body</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Email body content..." className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" required /></div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50")}>{saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : "Create Template"}</button>
          </div>
        </form>
      )}

      {error && !showCreate && !editingId && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <div className="bg-card rounded-xl border">
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div> : templates.length === 0 ? (
          <div className="p-12 text-center"><Mail className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-medium">No templates</h3><p className="text-muted-foreground mt-1">Create email templates for consistent candidate communication.</p></div>
        ) : (
          <div className="divide-y">
            {templates.map((t) => (
              <div key={t.id} className="p-5">
                {editingId === t.id ? (
                  <form onSubmit={handleUpdate} className="space-y-4">
                    {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium mb-1.5">Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Interview Invite" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required /></div>
                      <div><label className="block text-sm font-medium mb-1.5">Category</label><input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Interview, Rejection" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
                    </div>
                    <div><label className="block text-sm font-medium mb-1.5">Subject</label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required /></div>
                    <div><label className="block text-sm font-medium mb-1.5">Body</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Email body content..." className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" required /></div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                      <button type="submit" disabled={saving} className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50")}>{saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : "Save"}</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{t.name}</p>
                          {t.category && <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{t.category}</span>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">Subject: {t.subject}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => startEdit(t)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit template"><Pencil className="w-4 h-4" /></button>
                        {deleteConfirmId === t.id ? (
                          <span className="flex items-center gap-2 text-sm">
                            <button type="button" onClick={() => handleDelete(t.id)} disabled={deleting} className="px-2 py-1 rounded bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50">Delete</button>
                            <button type="button" onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 rounded border text-xs font-medium hover:bg-muted">Cancel</button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setDeleteConfirmId(t.id)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors" aria-label="Delete template"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
