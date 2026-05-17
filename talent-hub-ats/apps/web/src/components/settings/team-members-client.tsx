"use client";

import { useState, useCallback } from "react";
import { Users, Mail, Plus, Pencil, X, Loader2, Power, Copy, Check, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { ROLE_LABELS } from "@talent-hub/shared";

// Roles available for assignment (excludes SUPER_ADMIN and LIMITED for normal invite)
const ASSIGNABLE_ROLES = [
  { value: "RECRUITER", label: "Recruiter" },
  { value: "SUB_RECRUITER", label: "Sub-Recruiter" },
  { value: "HIRING_MANAGER", label: "Hiring Manager" },
  { value: "INTERVIEWER", label: "Interviewer" },
];

const ADMIN_ASSIGNABLE_ROLES = [
  { value: "ADMIN", label: "Admin" },
  ...ASSIGNABLE_ROLES,
];

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
  title: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface TeamMembersClientProps {
  initialMembers: TeamMember[];
  currentUserId: string;
  currentUserRole: string;
}

export function TeamMembersClient({
  initialMembers,
  currentUserId,
  currentUserRole,
}: TeamMembersClientProps) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const isAdmin =
    currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN";

  const roleOptions =
    currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN"
      ? ADMIN_ASSIGNABLE_ROLES
      : ASSIGNABLE_ROLES;

  const handleInviteSuccess = useCallback((newMember: TeamMember & { tempPassword?: string }) => {
    const { tempPassword, ...member } = newMember;
    setMembers((prev) => [...prev, member]);
    setShowInviteModal(false);
    if (tempPassword) {
      setCredentials({ email: member.email, password: tempPassword });
    } else {
      toast.success("Member invited successfully");
    }
  }, []);

  const handleEditSuccess = useCallback((updated: TeamMember) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
    );
    toast.success("Member updated successfully");
    setEditingMember(null);
  }, []);

  const handleToggleActive = useCallback(
    async (member: TeamMember) => {
      if (member.id === currentUserId) {
        toast.error("You cannot deactivate yourself");
        return;
      }

      setTogglingId(member.id);
      try {
        const res = await fetch(getApiUrl(`/api/users/${member.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !member.isActive }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update user");

        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id ? { ...m, isActive: data.isActive } : m
          )
        );
        toast.success(
          data.isActive ? "Member activated" : "Member deactivated"
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to toggle status"
        );
      } finally {
        setTogglingId(null);
      }
    },
    [currentUserId]
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1">
            Manage users, roles, and permissions for your organization
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Invite Member
          </button>
        )}
      </div>

      <div className="bg-card rounded-xl border">
        <div className="divide-y">
          {members.map((member) => (
            <div
              key={member.id}
              className={cn(
                "flex items-center justify-between p-5 group",
                !member.isActive && "opacity-60"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {member.name || "No name"}
                    {!member.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        (inactive)
                      </span>
                    )}
                    {member.id === currentUserId && (
                      <span className="ml-2 text-xs text-primary font-normal">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                    <Mail className="w-3.5 h-3.5" />
                    {member.email}
                  </p>
                  {member.title && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {member.title}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                  {member.lastLoginAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last login:{" "}
                      {new Date(member.lastLoginAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {isAdmin && member.id !== currentUserId && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingMember(member)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title="Edit member"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(member)}
                      disabled={togglingId === member.id}
                      className={cn(
                        "p-1.5 rounded-lg hover:bg-muted transition-colors",
                        togglingId === member.id && "opacity-50"
                      )}
                      title={
                        member.isActive
                          ? "Deactivate member"
                          : "Activate member"
                      }
                    >
                      {togglingId === member.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Power
                          className={cn(
                            "w-4 h-4",
                            member.isActive
                              ? "text-muted-foreground"
                              : "text-green-500"
                          )}
                        />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {members.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No team members</h3>
            <p className="text-muted-foreground mt-1">
              Users in your organization will appear here.
            </p>
          </div>
        )}
      </div>

      {showInviteModal && (
        <InviteMemberModal
          roleOptions={roleOptions}
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      {credentials && (
        <CredentialsDialog
          email={credentials.email}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          roleOptions={roleOptions}
          currentUserRole={currentUserRole}
          onClose={() => setEditingMember(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}

// ─── Invite Member Modal ────────────────────────────────────────────────────

interface InviteMemberModalProps {
  roleOptions: { value: string; label: string }[];
  onClose: () => void;
  onSuccess: (member: TeamMember & { tempPassword?: string }) => void;
}

function InviteMemberModal({
  roleOptions,
  onClose,
  onSuccess,
}: InviteMemberModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.value ?? "RECRUITER");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password && password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(getApiUrl("/api/users/invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          title: title.trim() || undefined,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite user");
      onSuccess(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to invite user"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-card rounded-xl border shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Invite Member</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Email <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Title{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Recruiter"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Initial Password{" "}
              <span className="text-muted-foreground font-normal">
                (optional — leave blank to auto-generate)
              </span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full px-3 py-2 pr-10 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Inviting...
                </>
              ) : (
                "Invite Member"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Credentials Dialog ─────────────────────────────────────────────────────

interface CredentialsDialogProps {
  email: string;
  password: string;
  onClose: () => void;
}

function CredentialsDialog({ email, password, onClose }: CredentialsDialogProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const copy = async (text: string, which: "email" | "password") => {
    await navigator.clipboard.writeText(text);
    if (which === "email") {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-xl border shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Member Invited</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Share these credentials with the new member. This password will not be shown again.
          </p>
          <div className="rounded-lg border bg-muted/40 divide-y">
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                <p className="text-sm font-medium truncate">{email}</p>
              </div>
              <button
                onClick={() => copy(email, "email")}
                className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
                title="Copy email"
              >
                {copiedEmail ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Temporary password</p>
                <p className="text-sm font-mono font-medium break-all">{password}</p>
              </div>
              <button
                onClick={() => copy(password, "password")}
                className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
                title="Copy password"
              >
                {copiedPassword ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The member should change their password after their first login.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Member Modal ──────────────────────────────────────────────────────

interface EditMemberModalProps {
  member: TeamMember;
  roleOptions: { value: string; label: string }[];
  currentUserRole: string;
  onClose: () => void;
  onSuccess: (member: TeamMember) => void;
}

function EditMemberModal({
  member,
  roleOptions,
  currentUserRole,
  onClose,
  onSuccess,
}: EditMemberModalProps) {
  const [name, setName] = useState(member.name || "");
  const [role, setRole] = useState(member.role);
  const [title, setTitle] = useState(member.title || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(getApiUrl(`/api/users/${member.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role,
          title: title.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      onSuccess(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update user"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-card rounded-xl border shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold">Edit Member</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {member.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Title{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Recruiter"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>

        {/* Reset Password — Super Admin only */}
        {isSuperAdmin && (
          <div className="border-t mx-0 px-5 py-4">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Reset Password
            </p>
            {resetSuccess && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-2">Password reset successfully.</p>
            )}
            {resetError && (
              <p className="text-xs text-destructive mb-2">{resetError}</p>
            )}
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                disabled={resetLoading || newPassword.length < 8}
                onClick={async () => {
                  setResetLoading(true);
                  setResetError(null);
                  setResetSuccess(false);
                  try {
                    const res = await fetch(getApiUrl(`/api/users/${member.id}`), {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ newPassword }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed to reset password");
                    setResetSuccess(true);
                    setNewPassword("");
                  } catch (err) {
                    setResetError(err instanceof Error ? err.message : "Failed");
                  } finally {
                    setResetLoading(false);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
