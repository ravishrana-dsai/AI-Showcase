"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Star,
  GripVertical,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";

interface Stage {
  name: string;
  type: string;
  order: number;
}

interface Template {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
  createdAt: string;
}

const STAGE_TYPES = [
  { value: "NEW", label: "New" },
  { value: "REACHED_OUT", label: "Reached Out" },
  { value: "SCREEN", label: "Screen" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "OFFER", label: "Offer" },
  { value: "HIRED", label: "Hired" },
  { value: "CUSTOM", label: "Custom" },
];

export default function PipelineTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStages, setNewStages] = useState([
    { name: "New", type: "NEW" },
    { name: "Phone Screen", type: "SCREEN" },
    { name: "Interview", type: "INTERVIEW" },
    { name: "Offer", type: "OFFER" },
    { name: "Hired", type: "HIRED" },
  ]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(getApiUrl("/api/settings/pipeline-templates"))
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(getApiUrl("/api/settings/pipeline-templates"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, stages: newStages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTemplates((prev) => [...prev, data]);
      setShowCreate(false);
      setNewName("");
      setNewStages([
        { name: "New", type: "NEW" },
        { name: "Phone Screen", type: "SCREEN" },
        { name: "Interview", type: "INTERVIEW" },
        { name: "Offer", type: "OFFER" },
        { name: "Hired", type: "HIRED" },
      ]);
      toast.success("Template created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function setDefault(id: string) {
    try {
      const res = await fetch(getApiUrl(`/api/settings/pipeline-templates/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error("Failed");
      setTemplates((prev) =>
        prev.map((t) => ({ ...t, isDefault: t.id === id }))
      );
      toast.success("Default template updated");
    } catch {
      toast.error("Failed to update default");
    }
  }

  async function deleteTemplate(id: string) {
    try {
      const res = await fetch(getApiUrl(`/api/settings/pipeline-templates/${id}`), {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  function addStage() {
    setNewStages((prev) => [...prev, { name: "", type: "CUSTOM" }]);
  }

  function removeStage(idx: number) {
    setNewStages((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateStage(idx: number, field: "name" | "type", value: string) {
    setNewStages((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define reusable hiring pipeline stages that can be applied when creating new jobs.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New template
        </button>
      </div>

      <div className="grid gap-4">
        {templates.map((template) => (
          <div key={template.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{template.name}</h3>
                {template.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Star className="h-3 w-3 fill-current" />
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!template.isDefault && (
                  <button
                    onClick={() => setDefault(template.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Set as default"
                  >
                    Set default
                  </button>
                )}
                {!template.isDefault && (
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {template.stages.map((stage, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                >
                  <span className="text-muted-foreground">{idx + 1}.</span>
                  {stage.name}
                </span>
              ))}
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No templates yet. Create one above.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Create pipeline template</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Template name *</label>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Standard Engineering"
                  className="mt-1 w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Stages</label>
                  <button
                    type="button"
                    onClick={addStage}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add stage
                  </button>
                </div>
                <div className="space-y-2">
                  {newStages.map((stage, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                      <input
                        required
                        value={stage.name}
                        onChange={(e) => updateStage(idx, "name", e.target.value)}
                        placeholder="Stage name"
                        className="flex-1 rounded-lg border bg-muted/50 px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <select
                        value={stage.type}
                        onChange={(e) => updateStage(idx, "type", e.target.value)}
                        className="rounded-lg border bg-muted/50 px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {STAGE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      {newStages.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeStage(idx)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {creating ? "Creating…" : "Create template"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
