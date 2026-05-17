"use client";

import { useState } from "react";
import { FileText, Download, Upload } from "lucide-react";
import { ResumeUpload } from "./resume-upload";
import { formatRelativeTime } from "@/lib/utils";

interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  uploadedAt: string;
}

interface CandidateDocumentsProps {
  candidateId: string;
  documents: DocumentInfo[];
}

export function CandidateDocuments({
  candidateId,
  documents: initialDocuments,
}: CandidateDocumentsProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Documents
        </h2>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-info hover:underline"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Resume
        </button>
      </div>

      {showUpload && (
        <div className="mb-4">
          <ResumeUpload
            candidateId={candidateId}
            mode="attach"
            onUploadComplete={(result) => {
              if (result.success && result.document) {
                setDocuments((prev) => [
                  {
                    id: result.document.id,
                    name: result.document.name,
                    type: result.document.type,
                    url: result.document.url,
                    size: result.document.size,
                    uploadedAt: new Date().toISOString(),
                  },
                  ...prev,
                ]);
                setShowUpload(false);
              }
            }}
          />
        </div>
      )}

      {documents.length === 0 && !showUpload ? (
        <p className="text-sm text-muted-foreground">
          No documents uploaded yet. Click &quot;Upload Resume&quot; to add one.
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.type} &bull; {(doc.size / 1024).toFixed(0)} KB &bull;{" "}
                  {formatRelativeTime(doc.uploadedAt)}
                </p>
              </div>
              <a
                href={`/api/files${doc.url.replace("/uploads", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                title="Download"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
