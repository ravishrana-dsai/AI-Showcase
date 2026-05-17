"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";

interface CustomField {
  id: string;
  name: string;
  fieldKey: string;
  type: string;
  entityType: string;
  options: string | null;
  isRequired: boolean;
  createdAt: string;
}

const ENTITY_TYPES = [
  { value: "CANDIDATE", label: "Candidate" },
  { value: "JOB", label: "Job" },
  { value: "APPLICATION", label: "Application" },
  { value: "OFFER", label: "Offer" },
];

const FIELD_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Dropdown (Single)" },
  { value: "MULTI_SELECT", label: "Dropdown (Multi)" },
  { value: "BOOLEAN", label: "Yes / No" },
  { value: "URL", label: "URL" },
];

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [type, setType] = useState("TEXT");
  const [entityType, setEntityType] = useState("CANDIDATE");
  const [options, setOptions] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(getApiUrl("/api/settings/custom-fields"))
      .then((r) => r.json())
      .then(setFields)
      .catch(() => toast.error("Failed to load custom fields"))
      .finally(() => setLoading(false));
  }, []);

  const grouped: Record<string, CustomField[]> = {};
  for (const field of fields) {
    if (!grouped[field.entityType]) grouped[field.entityType] = [];
    grouped[field.entityType].push(field);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const optionsList =
        ["SELECT", "MULTI_SELECT"].includes(type) && options
          ? options.split("\n").map((o) => o.trim()).filter(Boolean)
          : undefined;

      const res = await fetch(getApiUrl("/api/settings/custom-fields"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          fieldKey,
          type,
          entityType,
          options: optionsList,
          isRequired,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFields((prev) => [...prev, data]);
      setShowCreate(false);
      resetForm();
      toast.success("Custom field created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setName("");
    setFieldKey("");
    setType("TEXT");
    setEntityType("CANDIDATE");
    setOptions("");
    setIsRequired(false);
  }

  async function deleteField(id: string) {
    if (!confirm("Delete this custom field? Existing data will not be removed.")) return;
    try {
      const res = await fetch(getApiUrl(`/api/settings/custom-fields/${id}`), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      setFields((prev) => prev.filter((f) => f.id !== id));
      toast.success("Field deleted");
    } catch {
      toast.error("Failed to delete field");
    }
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
          <h1 className="text-2xl font-semibold tracking-tight">Custom Fields</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add extra fields to candidates, jobs, applications, and offers.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add field
        </button>
      </div>

      {Object.entries(grouped).map(([entity, entityFields]) => (
        <div key={entity} className="rounded-xl border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-medium">
              {ENTITY_TYPES.find((e) => e.value === entity)?.label ?? entity}
            </h2>
          </div>
          <div className="divide-y">
            {entityFields.map((field) => (
              <div key={field.id} className="flex items-center gap-4 px-6 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{field.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {field.fieldKey}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      {FIELD_TYPES.find((t) => t.value === field.type)?.label}
                    </span>
                    {field.isRequired && (
                      <span className="text-xs text-red-500">Required</span>
                    )}
                  </div>
                  {field.options && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Options: {JSON.parse(field.options).join(", ")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteField(field.id)}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {fields.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No custom fields yet. Add one above.</p>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Add custom field</h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Entity *</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {ENTITY_TYPES.map((e) => (
                      <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Field label *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldKey(
                      e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, "_")
                        .replace(/[^a-z0-9_]/g, "")
                    );
                  }}
                  placeholder="e.g. GitHub Profile"
                  className="mt-1 w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Field key *</label>
                <input
                  required
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="github_profile"
                  className="mt-1 w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used as the internal key (lowercase, underscores only)
                </p>
              </div>
              {["SELECT", "MULTI_SELECT"].includes(type) && (
                <div>
                  <label className="text-sm font-medium">Options (one per line)</label>
                  <textarea
                    value={options}
                    onChange={(e) => setOptions(e.target.value)}
                    rows={4}
                    placeholder={"Option A\nOption B\nOption C"}
                    className="mt-1 w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRequired"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="isRequired" className="text-sm">Required field</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create field"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); resetForm(); }}
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
