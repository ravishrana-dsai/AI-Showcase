"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ScoringWeights {
  communication: number;
  role_fit: number;
  motivation: number;
  culture_fit: number;
  problem_solving: number;
}

interface Role {
  id: string;
  name: string;
  slug: string;
  questionBank: string[];
  scoringWeights: ScoringWeights;
  createdAt: Date;
}

interface RolesManagerProps {
  roles: Role[];
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  communication: 0.2,
  role_fit: 0.25,
  motivation: 0.2,
  culture_fit: 0.15,
  problem_solving: 0.2,
};

export function RolesManager({ roles: initialRoles }: RolesManagerProps) {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this role? This cannot be undone.")) return;
    await fetch(`/api/admin/roles/${id}`, { method: "DELETE" });
    setRoles((r) => r.filter((role) => role.id !== id));
  };

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div>
          <button style={styles.backBtn} onClick={() => router.push("/admin")}>
            &larr; Dashboard
          </button>
          <h1 style={styles.heading}>Role Management</h1>
        </div>
        <button style={styles.primaryBtn} onClick={() => setShowCreate(true)}>
          + New Role
        </button>
      </header>

      <div style={styles.content}>
        {roles.length === 0 && (
          <p style={styles.empty}>No roles yet. Create one to get started.</p>
        )}
        {roles.map((role) => (
          <div key={role.id} style={styles.roleCard}>
            {editingId === role.id ? (
              <RoleEditor
                role={role}
                onSave={async (updated) => {
                  const res = await fetch(`/api/admin/roles/${role.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updated),
                  });
                  if (res.ok) {
                    const saved = (await res.json()) as Role;
                    setRoles((r) => r.map((x) => (x.id === role.id ? saved : x)));
                    setEditingId(null);
                  }
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <RoleView
                role={role}
                onEdit={() => setEditingId(role.id)}
                onDelete={() => handleDelete(role.id)}
              />
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateRoleModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            const res = await fetch("/api/admin/roles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (res.ok) {
              const created = (await res.json()) as Role;
              setRoles((r) => [...r, created]);
              setShowCreate(false);
            }
          }}
        />
      )}
    </div>
  );
}

function RoleView({
  role,
  onEdit,
  onDelete,
}: {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <div style={styles.roleHeader}>
        <div>
          <h2 style={styles.roleName}>{role.name}</h2>
          <span style={styles.roleSlug}>{role.slug}</span>
        </div>
        <div style={styles.roleActions}>
          <button style={styles.secondaryBtn} onClick={onEdit}>
            Edit
          </button>
          <button style={styles.dangerBtn} onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <p style={styles.sectionTitle}>Questions ({role.questionBank.length})</p>
        <ol style={styles.questionList}>
          {role.questionBank.map((q, i) => (
            <li key={i} style={styles.questionItem}>
              {q}
            </li>
          ))}
        </ol>
      </div>

      <div style={styles.section}>
        <p style={styles.sectionTitle}>Scoring Weights</p>
        <div style={styles.weightsGrid}>
          {Object.entries(role.scoringWeights).map(([key, val]) => (
            <div key={key} style={styles.weightRow}>
              <span style={styles.weightLabel}>
                {key.replace("_", " ")}
              </span>
              <span style={styles.weightVal}>
                {Math.round((val as number) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoleEditor({
  role,
  onSave,
  onCancel,
}: {
  role: Role;
  onSave: (data: { name: string; questionBank: string[]; scoringWeights: ScoringWeights }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [questions, setQuestions] = useState<string[]>(role.questionBank);
  const [weights, setWeights] = useState<ScoringWeights>(role.scoringWeights);

  const updateQuestion = (i: number, val: string) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? val : q)));

  const addQuestion = () => setQuestions((qs) => [...qs, ""]);
  const removeQuestion = (i: number) =>
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));

  const updateWeight = (key: keyof ScoringWeights, val: string) => {
    const num = parseFloat(val) / 100;
    setWeights((w) => ({ ...w, [key]: isNaN(num) ? 0 : num }));
  };

  return (
    <div style={styles.editor}>
      <div style={styles.editorHeader}>
        <h2 style={styles.roleName}>Editing: {role.name}</h2>
        <div style={styles.roleActions}>
          <button
            style={styles.primaryBtn}
            onClick={() => onSave({ name, questionBank: questions.filter(Boolean), scoringWeights: weights })}
          >
            Save
          </button>
          <button style={styles.secondaryBtn} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <label style={styles.fieldLabel}>
          Role Name
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </div>

      <div style={styles.section}>
        <p style={styles.sectionTitle}>Questions</p>
        {questions.map((q, i) => (
          <div key={i} style={styles.questionEditRow}>
            <span style={styles.questionNum}>{i + 1}</span>
            <textarea
              style={styles.questionInput}
              value={q}
              onChange={(e) => updateQuestion(i, e.target.value)}
              rows={2}
            />
            <button
              style={styles.removeBtn}
              onClick={() => removeQuestion(i)}
              aria-label="Remove question"
            >
              &times;
            </button>
          </div>
        ))}
        <button style={styles.addBtn} onClick={addQuestion}>
          + Add Question
        </button>
      </div>

      <div style={styles.section}>
        <p style={styles.sectionTitle}>Scoring Weights (%)</p>
        <div style={styles.weightsGrid}>
          {(Object.keys(weights) as (keyof ScoringWeights)[]).map((key) => (
            <div key={key} style={styles.weightEditRow}>
              <label style={styles.weightLabel}>{key.replace("_", " ")}</label>
              <input
                style={styles.weightInput}
                type="number"
                min="0"
                max="100"
                value={Math.round(weights[key] * 100)}
                onChange={(e) => updateWeight(key, e.target.value)}
              />
              <span style={styles.pctSign}>%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateRoleModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: {
    name: string;
    slug: string;
    questionBank: string[];
    scoringWeights: ScoringWeights;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [questions, setQuestions] = useState(["", "", "", "", "", ""]);
  const [weights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, "_"),
      questionBank: questions.filter(Boolean),
      scoringWeights: weights,
    });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.editorHeader}>
          <h2 style={styles.modalTitle}>Create New Role</h2>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.fieldLabel}>
            Role Name
            <input
              style={styles.input}
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, "_"));
              }}
              placeholder="e.g. Product Designer"
            />
          </label>
          <label style={styles.fieldLabel}>
            Slug (URL-safe identifier)
            <input
              style={styles.input}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="product_designer"
            />
          </label>
          <p style={styles.sectionTitle}>Questions (6 recommended)</p>
          {questions.map((q, i) => (
            <textarea
              key={i}
              style={styles.questionInput}
              value={q}
              onChange={(e) =>
                setQuestions((qs) => qs.map((x, idx) => (idx === i ? e.target.value : x)))
              }
              placeholder={`Question ${i + 1}`}
              rows={2}
            />
          ))}
          <button type="submit" style={styles.primaryBtn}>
            Create Role
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "#0F1117", color: "#F0F4FF" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: "24px 32px 20px",
    borderBottom: "1px solid #2A2F3D",
    background: "#181C27",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#8B93A8",
    fontSize: 13,
    cursor: "pointer",
    marginBottom: 6,
    padding: 0,
  },
  heading: { fontSize: 22, fontWeight: 700, color: "#F0F4FF" },
  primaryBtn: {
    padding: "9px 18px",
    background: "#00C2FF",
    border: "none",
    borderRadius: 8,
    color: "#000",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "9px 18px",
    background: "transparent",
    border: "1px solid #2A2F3D",
    borderRadius: 8,
    color: "#F0F4FF",
    fontWeight: 500,
    fontSize: 13,
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "9px 18px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8,
    color: "#EF4444",
    fontWeight: 500,
    fontSize: 13,
    cursor: "pointer",
  },
  content: { padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 },
  empty: { color: "#4A5168", fontSize: 14 },
  roleCard: {
    background: "#181C27",
    border: "1px solid #2A2F3D",
    borderRadius: 12,
    padding: "20px 24px",
  },
  roleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  roleName: { fontSize: 17, fontWeight: 700, color: "#F0F4FF" },
  roleSlug: {
    fontSize: 11,
    color: "#4A5168",
    fontFamily: "monospace",
    background: "#1F2433",
    padding: "2px 6px",
    borderRadius: 4,
    marginTop: 4,
    display: "inline-block",
  },
  roleActions: { display: "flex", gap: 8 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#4A5168",
    marginBottom: 10,
  },
  questionList: {
    paddingLeft: 18,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  questionItem: { fontSize: 14, color: "#8B93A8", lineHeight: 1.5 },
  weightsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 8,
  },
  weightRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 10px",
    background: "#1F2433",
    borderRadius: 6,
    fontSize: 13,
  },
  weightLabel: { color: "#8B93A8", textTransform: "capitalize" as const },
  weightVal: { color: "#00C2FF", fontWeight: 600, fontFamily: "monospace" },
  editor: { display: "flex", flexDirection: "column", gap: 4 },
  editorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  fieldLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    color: "#8B93A8",
    fontWeight: 500,
  },
  input: {
    padding: "10px 12px",
    background: "#1F2433",
    border: "1px solid #2A2F3D",
    borderRadius: 8,
    color: "#F0F4FF",
    fontSize: 14,
    outline: "none",
  },
  questionEditRow: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  questionNum: {
    minWidth: 22,
    height: 22,
    borderRadius: "50%",
    background: "#2A2F3D",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    color: "#8B93A8",
    marginTop: 8,
    textAlign: "center",
  },
  questionInput: {
    flex: 1,
    padding: "8px 10px",
    background: "#1F2433",
    border: "1px solid #2A2F3D",
    borderRadius: 8,
    color: "#F0F4FF",
    fontSize: 13,
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#EF4444",
    fontSize: 18,
    cursor: "pointer",
    marginTop: 6,
    lineHeight: 1,
  },
  addBtn: {
    padding: "7px 14px",
    background: "transparent",
    border: "1px dashed #2A2F3D",
    borderRadius: 8,
    color: "#8B93A8",
    fontSize: 13,
    cursor: "pointer",
    marginTop: 4,
  },
  weightEditRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    background: "#1F2433",
    borderRadius: 6,
  },
  weightInput: {
    width: 56,
    padding: "4px 6px",
    background: "#2A2F3D",
    border: "1px solid #3A4050",
    borderRadius: 6,
    color: "#F0F4FF",
    fontSize: 13,
    textAlign: "right" as const,
  },
  pctSign: { fontSize: 13, color: "#4A5168" },
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    width: "90%",
    maxWidth: 540,
    maxHeight: "85vh",
    overflowY: "auto",
    background: "#181C27",
    border: "1px solid #2A2F3D",
    borderRadius: 16,
    padding: "28px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#F0F4FF" },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8B93A8",
    fontSize: 22,
    cursor: "pointer",
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
};
