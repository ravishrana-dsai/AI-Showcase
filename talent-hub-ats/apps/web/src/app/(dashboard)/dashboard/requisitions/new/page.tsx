"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

const LEVELS = ["1","2","3","4","5","6","7","8","9"];

export default function NewRequisitionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [headcount, setHeadcount] = useState(1);
  const [priority, setPriority] = useState("MEDIUM");
  const [level, setLevel] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("INR");
  const [justification, setJustification] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/requisitions/create"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), department: department.trim() || null, headcount, priority, level: level || undefined, salaryMin: salaryMin ? Number(salaryMin) : undefined, salaryMax: salaryMax ? Number(salaryMax) : undefined, salaryCurrency, justification: justification.trim() || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create requisition");
      router.push("/dashboard/requisitions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create requisition");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/requisitions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" />Back to Requisitions</Link>
      <div><h1 className="text-2xl font-bold">New Requisition</h1><p className="text-muted-foreground mt-1">Create a headcount request</p></div>
      <form onSubmit={handleSubmit} className="bg-card rounded-xl border p-6 space-y-5">
        {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <div><label className="block text-sm font-medium mb-1.5">Title <span className="text-destructive">*</span></label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Senior Software Engineer" required /></div>
        <div><label className="block text-sm font-medium mb-1.5">Department</label><input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Engineering" /></div>
        <div className="grid grid-cols-3 gap-4">
          <div><label className="block text-sm font-medium mb-1.5">Headcount</label><input type="number" value={headcount} onChange={(e) => setHeadcount(Number(e.target.value) || 1)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" min={1} /></div>
          <div><label className="block text-sm font-medium mb-1.5">Priority</label><select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"><option value="CRITICAL">P0 (Critical)</option><option value="HIGH">P1 (High)</option><option value="MEDIUM">P2 (Medium)</option><option value="LOW">P3 (Low)</option></select></div>
          <div><label className="block text-sm font-medium mb-1.5">Level</label><select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"><option value="">— Not set —</option>{LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><label className="block text-sm font-medium mb-1.5">Salary Min</label><input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder={salaryCurrency === "INR" ? "e.g. 25 (LPA)" : "e.g. 80000"} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" min={0} /></div>
          <div><label className="block text-sm font-medium mb-1.5">Salary Max</label><input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder={salaryCurrency === "INR" ? "e.g. 45 (LPA)" : "e.g. 120000"} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" min={0} /></div>
          <div><label className="block text-sm font-medium mb-1.5">Currency</label><select value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">{["INR", "USD", "EUR", "GBP"].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div><label className="block text-sm font-medium mb-1.5">Justification</label><textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Business justification..." /></div>
        <div className="flex justify-end gap-2 pt-2">
          <Link href="/dashboard/requisitions" className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">Cancel</Link>
          <button type="submit" disabled={loading} className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50")}>{loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : "Create Requisition"}</button>
        </div>
      </form>
    </div>
  );
}
