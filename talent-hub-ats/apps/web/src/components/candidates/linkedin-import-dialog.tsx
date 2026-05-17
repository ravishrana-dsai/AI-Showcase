"use client";

import { useState } from "react";
import { Linkedin, Loader2, X, ExternalLink } from "lucide-react";
import type { LinkedInProfileData } from "@/lib/linkedin/linkedin-types";
import { getApiUrl } from "@/lib/api";

interface LinkedInImportDialogProps {
  onImport: (profile: LinkedInProfileData) => void;
  onClose: () => void;
}

export function LinkedInImportDialog({ onImport, onClose }: LinkedInImportDialogProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<LinkedInProfileData | null>(null);

  async function handleImport() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/candidates/import-linkedin"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        return;
      }
      setPreview(data.profile);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Import from LinkedIn</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!preview ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/johndoe"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Must be a public LinkedIn profile URL (linkedin.com/in/...)
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </p>
              )}

              <button
                onClick={handleImport}
                disabled={!url.trim() || loading}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Importing..." : "Import Profile"}
              </button>
            </>
          ) : (
            <>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="font-medium text-gray-900">
                  {preview.firstName} {preview.lastName}
                </h3>
                {preview.headline && (
                  <p className="text-sm text-gray-600">{preview.headline}</p>
                )}
                {preview.currentTitle && preview.currentCompany && (
                  <p className="text-sm text-gray-500">
                    {preview.currentTitle} at {preview.currentCompany}
                  </p>
                )}
                {preview.location && (
                  <p className="text-sm text-gray-500">{preview.location}</p>
                )}
                {preview.email && (
                  <p className="text-sm text-gray-500">{preview.email}</p>
                )}
                {preview.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {preview.skills.slice(0, 8).map((s) => (
                      <span
                        key={s}
                        className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                    {preview.skills.length > 8 && (
                      <span className="text-xs text-gray-400">
                        +{preview.skills.length - 8} more
                      </span>
                    )}
                  </div>
                )}
                <a
                  href={preview.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> View on LinkedIn
                </a>
              </div>

              <p className="text-xs text-gray-500">
                Review the data above. Click "Create Candidate" to pre-fill the form with this information.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setPreview(null)}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => onImport(preview)}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Create Candidate
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
