"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface UploadResult {
  success: boolean;
  candidate?: any;
  parsed?: any;
  matchScore?: number;
  isDuplicate?: boolean;
  message?: string;
  error?: string;
  document?: any;
  /** True when no email was found on the resume; a placeholder address was stored. */
  emailPending?: boolean;
}

interface ResumeUploadProps {
  candidateId?: string;
  jobId?: string;
  mode?: "parse_only" | "create_candidate" | "attach";
  onUploadComplete?: (result: UploadResult) => void;
  multiple?: boolean;
  className?: string;
  /** When true, show PDF smart recovery (OCR) toggle between intro and drop zone. Default true. */
  showPdfOcrToggle?: boolean;
}

interface FileUploadState {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  result?: UploadResult;
  error?: string;
}

export function ResumeUpload({
  candidateId,
  jobId,
  mode = "create_candidate",
  onUploadComplete,
  multiple = false,
  className,
  showPdfOcrToggle = true,
}: ResumeUploadProps) {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  /** When checked, allow optional OCR when text is long but low-quality; thin text always OCRs. */
  const [pdfSmartRecovery, setPdfSmartRecovery] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles = fileArray.filter((f) =>
        [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
          "text/plain",
        ].includes(f.type)
      );

      if (validFiles.length === 0) return;

      const fileStates: FileUploadState[] = validFiles.map((f) => ({
        file: f,
        status: "pending" as const,
      }));

      setFiles((prev) => (multiple ? [...prev, ...fileStates] : fileStates));

      // Upload each file
      for (let i = 0; i < fileStates.length; i++) {
        const fileState = fileStates[i];

        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileState.file ? { ...f, status: "uploading" } : f
          )
        );

        try {
          const formData = new FormData();
          formData.append("file", fileState.file);
          formData.append("mode", mode);
          if (candidateId) formData.append("candidateId", candidateId);
          if (jobId) formData.append("jobId", jobId);
          if (!pdfSmartRecovery) formData.append("pdfOcr", "skip");

          const res = await fetch(getApiUrl("/api/upload"), {
            method: "POST",
            body: formData,
          });

          const result: UploadResult = await res.json();

          setFiles((prev) =>
            prev.map((f) =>
              f.file === fileState.file
                ? {
                    ...f,
                    status: result.success ? "success" : "error",
                    result,
                    error: result.error,
                  }
                : f
            )
          );

          if (onUploadComplete) {
            onUploadComplete(result);
          }
        } catch (err) {
          setFiles((prev) =>
            prev.map((f) =>
              f.file === fileState.file
                ? { ...f, status: "error", error: "Upload failed" }
                : f
            )
          );
        }
      }
    },
    [candidateId, jobId, mode, multiple, onUploadComplete, pdfSmartRecovery]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file));
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          multiple={multiple}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        <Upload
          className={cn(
            "w-10 h-10 mx-auto mb-3",
            isDragging ? "text-primary" : "text-muted-foreground"
          )}
        />
        <p className="text-sm font-medium">
          {isDragging
            ? "Drop files here"
            : multiple
              ? "Drag & drop resumes here, or click to browse"
              : "Drag & drop a resume here, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports PDF, DOCX, DOC, TXT (max 10MB)
        </p>
        {showPdfOcrToggle && (
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-left mx-auto max-w-md">
            <input
              type="checkbox"
              checked={pdfSmartRecovery}
              onChange={(e) => setPdfSmartRecovery(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 rounded border-input"
            />
            <span className="text-xs text-muted-foreground leading-snug">
              <span className="font-medium text-foreground">Extra OCR on noisy text</span>
              {" — "}
              When extraction is empty or short, OCR runs automatically (unless disabled in server
              env). Uncheck this to skip the extra OCR pass when
              the PDF already has lots of text but it looks like garbage (faster). Merged text
              combines both layers without duplicate lines.
            </span>
          </label>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileState, idx) => (
            <div
              key={`${fileState.file.name}-${idx}`}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {fileState.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(fileState.file.size / 1024).toFixed(0)} KB
                  {fileState.result?.parsed?.skills?.length
                    ? ` · ${fileState.result.parsed.skills.length} skills detected`
                    : ""}
                  {fileState.result?.matchScore != null
                    ? ` · ${fileState.result.matchScore}% match`
                    : ""}
                  {fileState.result?.isDuplicate
                    ? " · Duplicate candidate"
                    : ""}
                </p>
                {fileState.result?.candidate && (
                  <p className="text-xs text-success mt-0.5">
                    {fileState.result.isDuplicate ? "Attached to" : "Created"}{" "}
                    {fileState.result.candidate.firstName}{" "}
                    {fileState.result.candidate.lastName} (
                    {fileState.result.candidate.email})
                  </p>
                )}
                {fileState.result?.success && fileState.result.emailPending && (
                  <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                    No email on resume — add a real address on the candidate
                    profile.
                  </p>
                )}
                {fileState.error && (
                  <p className="text-xs text-destructive mt-0.5">
                    {fileState.error}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {fileState.status === "uploading" && (
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                )}
                {fileState.status === "success" && (
                  <CheckCircle className="w-5 h-5 text-success" />
                )}
                {fileState.status === "error" && (
                  <AlertCircle className="w-5 h-5 text-destructive" />
                )}
                {fileState.status !== "uploading" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(fileState.file);
                    }}
                    className="ml-2 p-1 rounded hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Parsed Skills Preview */}
      {files.some((f) => f.result?.parsed?.skills?.length) && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Detected Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {files
              .flatMap((f) => f.result?.parsed?.skills || [])
              .filter((s, i, arr) => arr.indexOf(s) === i)
              .map((skill: string) => (
                <span
                  key={skill}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-info/10 text-info"
                >
                  {skill}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
