"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface CreateOfferModalProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateOfferModal({ applicationId, candidateName, jobTitle, onClose, onSuccess }: CreateOfferModalProps) {
  const [title, setTitle] = useState(jobTitle);
  const [salary, setSalary] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("INR");
  const [salaryPeriod, setSalaryPeriod] = useState("ANNUAL");
  const [equity, setEquity] = useState("");
  const [bonus, setBonus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/offers/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, title: title.trim(), salary: Number(salary), salaryCurrency, salaryPeriod, equity: equity.trim() || undefined, bonus: bonus.trim() || undefined, startDate: startDate || undefined, expiresAt: expiresAt || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create offer");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create offer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-card rounded-xl border shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-card rounded-t-xl">
          <div>
            <h2 className="text-lg font-semibold">Create Offer</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{candidateName} | {jobTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Salary</label>
              <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder={salaryCurrency === "INR" ? "e.g. 2500000 or 25 LPA" : "e.g. 120000"} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" min="0" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Currency</label>
              <select value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {["INR", "USD", "EUR", "GBP"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Period</label>
            <select value={salaryPeriod} onChange={(e) => setSalaryPeriod(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="ANNUAL">Annual</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Equity <span className="text-muted-foreground">(opt)</span></label>
              <input type="text" value={equity} onChange={(e) => setEquity(e.target.value)} placeholder="e.g. 0.1%" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Bonus <span className="text-muted-foreground">(opt)</span></label>
              <input type="text" value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="e.g. 10%" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Start Date <span className="text-muted-foreground">(opt)</span></label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Expires At <span className="text-muted-foreground">(opt)</span></label>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50")}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : "Create Offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
