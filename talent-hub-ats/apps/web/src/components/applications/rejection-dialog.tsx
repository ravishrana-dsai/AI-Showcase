"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";

const REJECTION_CATEGORIES = [
  { value: "NOT_QUALIFIED", label: "Not Qualified" },
  { value: "POSITION_FILLED", label: "Position Filled" },
  { value: "SALARY_MISMATCH", label: "Salary Mismatch" },
  { value: "CULTURE_FIT", label: "Culture Fit" },
  { value: "NO_SHOW", label: "No Show" },
  { value: "WITHDREW", label: "Candidate Withdrew" },
  { value: "OTHER", label: "Other" },
] as const;

interface EmailTemplate {
  id: string;
  name: string;
}

interface RejectionDialogProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  emailTemplates?: EmailTemplate[];
  onSuccess?: () => void;
  onClose: () => void;
}

export function RejectionDialog({
  applicationId,
  candidateName,
  jobTitle,
  emailTemplates = [],
  onSuccess,
  onClose,
}: RejectionDialogProps) {
  const [category, setCategory] = useState<string>("");
  const [reason, setReason] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) {
      toast.error("Please select a rejection reason category");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/applications/${applicationId}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          reason: reason.trim() || undefined,
          sendRejectionEmail: sendEmail,
          templateId: templateId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject application");
      }

      toast.success(`${candidateName} has been rejected`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Reject Application
        </h2>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          {candidateName} | {jobTitle}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reason Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">Select a reason...</option>
              {REJECTION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Additional Notes (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Internal notes about this rejection..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="send-email"
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="send-email" className="text-sm text-gray-700 dark:text-gray-300">
              Send rejection email to candidate
            </label>
          </div>

          {sendEmail && emailTemplates.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Template (optional)
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Default rejection email</option>
                {emailTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !category}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Rejecting..." : "Reject Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
