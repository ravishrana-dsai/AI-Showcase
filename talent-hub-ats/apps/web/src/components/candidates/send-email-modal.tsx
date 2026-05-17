"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface SendEmailModalProps {
  candidateEmail: string;
  candidateName: string;
  candidateId: string;
  onClose: () => void;
  initialSubject?: string;
  initialBody?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
}

export function SendEmailModal({ candidateEmail, candidateName, candidateId, onClose, initialSubject = "", initialBody = "" }: SendEmailModalProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(getApiUrl("/api/email/templates")).then((r) => r.json()).then((d) => setTemplates(d.templates ?? [])).catch(() => {});
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const t = templates.find((t) => t.id === templateId);
    if (t) {
      setSubject(t.subject.replace(/\{\{candidateName\}\}/g, candidateName));
      setBody(t.body.replace(/\{\{candidateName\}\}/g, candidateName));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/email/send"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: candidateEmail, subject, body, templateId: selectedTemplate || undefined, candidateId }) });
      if (!res.ok) throw new Error("Failed to send");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-card rounded-xl border shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-card rounded-t-xl">
          <h2 className="text-lg font-semibold">Send Email</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        {sent ? (
          <div className="p-8 text-center">
            <Send className="w-12 h-12 mx-auto text-success mb-4" />
            <h3 className="text-lg font-medium">Email Logged</h3>
            <p className="text-sm text-muted-foreground mt-1">Email to {candidateEmail} has been recorded.</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-5 space-y-4">
            <div className="text-sm text-muted-foreground">To: <span className="font-medium text-foreground">{candidateName}</span> ({candidateEmail})</div>
            {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium mb-1.5">Template (optional)</label>
              <select value={selectedTemplate} onChange={(e) => handleTemplateSelect(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Write from scratch...</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Body</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" required />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className={cn("flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2")}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send Email</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
