"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { samplePrds } from "@/lib/samplePrds";

export type SourceFile = { path: string; content: string };

type Props = {
  onGenerate: (prd: string, sourceFiles: SourceFile[]) => Promise<void>;
  disabled?: boolean;
  initialPrd?: string;
};

const SOURCE_ACCEPT = ".ts,.tsx,.js,.jsx,.css,.json,.md";
const MAX_CHARS = 20000;

export function PRDInput({ onGenerate, disabled, initialPrd }: Props) {
  const [prd, setPrd] = useState(initialPrd ?? "");
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);

  // Sync when a freshly generated PRD is passed in
  useEffect(() => {
    if (initialPrd) setPrd(initialPrd);
  }, [initialPrd]);
  const [pasteFileName, setPasteFileName] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsText(file);
    });

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "md" && ext !== "txt" && !file.name.endsWith(".markdown")) return;
      const text = await readFileAsText(file);
      setPrd(text);
      e.target.value = "";
    },
    []
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "md" || ext === "txt" || file.name.endsWith(".markdown")) {
        const text = await readFileAsText(file);
        setPrd(text);
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleSourceUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        const text = await readFileAsText(file);
        // Prefer the relative path (e.g. "components/Header.tsx") when the
        // browser provides it (directory upload). Fall back to just the filename.
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        const path = relativePath && relativePath.trim() ? relativePath : file.name;
        setSourceFiles((prev) => {
          if (prev.some((f) => f.path === path)) return prev;
          return [...prev, { path, content: text }];
        });
      }
      e.target.value = "";
    },
    []
  );

  const handleAddPasteBlock = useCallback(() => {
    const name = pasteFileName.trim();
    const code = pasteContent.trim();
    if (!name || !code) return;
    setSourceFiles((prev) => {
      if (prev.some((f) => f.path === name)) return prev;
      return [...prev, { path: name, content: code }];
    });
    setPasteFileName("");
    setPasteContent("");
  }, [pasteFileName, pasteContent]);

  const removeSourceFile = useCallback((path: string) => {
    setSourceFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = prd.trim();
      if (!trimmed) return;
      onGenerate(trimmed, sourceFiles);
    },
    [prd, sourceFiles, onGenerate]
  );

  const charCount = prd.length;
  const charPercent = Math.min((charCount / MAX_CHARS) * 100, 100);
  const isOverLimit = charCount > MAX_CHARS;

  // Warn if total source content is large (Gemini context pressure)
  const MAX_SOURCE_CHARS = 50000;
  const totalSourceChars = sourceFiles.reduce((sum, f) => sum + f.content.length, 0);
  const isSourceOverLimit = totalSourceChars > MAX_SOURCE_CHARS;

  // Files uploaded without a folder path — Gemini won't know where they live
  const filesWithNoPath = sourceFiles.filter((f) => !f.path.includes("/"));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* PRD label + char counter */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Product Requirements Document
        </label>
        {charCount > 0 && (
          <span className={`text-xs font-mono ${isOverLimit ? "text-red-500" : "text-slate-400"}`}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        )}
      </div>

      {/* Drag-and-drop upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-xl border-2 border-dashed transition-all duration-200 ${
          isDragOver
            ? "border-indigo-400 bg-indigo-50/60 scale-[1.01]"
            : "border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/20 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.markdown"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm text-slate-500 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isDragOver ? (
            <>
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="font-medium text-indigo-600">Drop to upload</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span>
                <span className="font-medium text-slate-600">Click to upload</span>
                <span className="text-slate-400"> or drag & drop</span>
                <span className="text-slate-400"> · .md or .txt</span>
              </span>
            </>
          )}
        </button>
      </div>

      {/* Sample PRD picker */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Or try a sample PRD:</p>
        <div className="flex flex-wrap gap-2">
          {samplePrds.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={disabled}
              onClick={() => setPrd(sample.content)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 disabled:pointer-events-none ${
                prd === sample.content
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
              }`}
              title={sample.description}
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={prd}
          onChange={(e) => setPrd(e.target.value)}
          placeholder="Paste your Product Requirements Document here…&#10;&#10;Include: problem statement, user goals, acceptance criteria."
          className={`w-full h-56 rounded-xl border bg-white px-4 py-3 text-slate-800 text-sm leading-relaxed placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow resize-none ${
            isOverLimit
              ? "border-red-300 focus:border-red-400"
              : "border-slate-300 focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-indigo-500"
          }`}
          disabled={disabled}
        />
        {charCount > 0 && (
          <div className="absolute bottom-3 right-3">
            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isOverLimit ? "bg-red-400" : charPercent > 80 ? "bg-amber-400" : "bg-indigo-400"}`}
                style={{ width: `${charPercent}%` }}
              />
            </div>
          </div>
        )}
        {prd.length > 0 && (
          <button
            type="button"
            onClick={() => setPrd("")}
            className="absolute top-3 right-3 p-1 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
            title="Clear"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Source files (optional, collapsible) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden dark:border-slate-700 dark:bg-slate-800/30">
        <button
          type="button"
          onClick={() => setSourceOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors dark:text-slate-400 dark:hover:text-slate-200"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            Attach Source Files
            <span className="text-xs text-slate-400 font-normal">(optional — modify existing code)</span>
          </span>
          <span className="flex items-center gap-2">
            {sourceFiles.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {sourceFiles.length}
              </span>
            )}
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${sourceOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </span>
        </button>

        {sourceOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
            {/* Attached file pills */}
            {sourceFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-3">
                {sourceFiles.map((f) => (
                  <span
                    key={f.path}
                    title={!f.path.includes("/") ? "No folder path — add as e.g. components/" + f.path : f.path}
                    className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-white border text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 ${
                      !f.path.includes("/")
                        ? "border-amber-300 dark:border-amber-700"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                    <span className="truncate max-w-[180px]">{f.path}</span>
                    <button
                      type="button"
                      onClick={() => removeSourceFile(f.path)}
                      className="ml-0.5 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Inline warnings — shown only when relevant */}
            {filesWithNoPath.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5 pt-1">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span>
                  {filesWithNoPath.length === 1
                    ? `"${filesWithNoPath[0].path}" has no folder path.`
                    : `${filesWithNoPath.length} files have no folder path.`}{" "}
                  Paste the file name as <span className="font-mono">folder/file.tsx</span> so the AI knows where it lives.
                </span>
              </p>
            )}
            {isSourceOverLimit && (
              <p className="text-xs text-red-500 dark:text-red-400 flex items-start gap-1.5 pt-1">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span>
                  Source files are large ({Math.round(totalSourceChars / 1000)}k chars). Consider removing files not directly related to the change to improve results.
                </span>
              </p>
            )}

            {/* Upload button */}
            <div className="pt-1">
              <input
                ref={sourceInputRef}
                type="file"
                accept={SOURCE_ACCEPT}
                multiple
                onChange={handleSourceUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => sourceInputRef.current?.click()}
                disabled={disabled}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-white text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload source files (.ts, .tsx, .js, .css, .json)
              </button>
            </div>

            {/* Paste code block */}
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-slate-500">Or paste a code block:</p>
              <input
                type="text"
                value={pasteFileName}
                onChange={(e) => setPasteFileName(e.target.value)}
                placeholder="File name (e.g. components/Header.tsx)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                disabled={disabled}
              />
              <textarea
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="Paste file content here..."
                className="w-full h-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 resize-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={handleAddPasteBlock}
                disabled={disabled || !pasteFileName.trim() || !pasteContent.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={disabled || !prd.trim() || isOverLimit || isSourceOverLimit}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          {sourceFiles.length > 0 ? "Modify & Generate" : "Generate Feature"}
        </button>
        {sourceFiles.length > 0 && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
            Modify mode active — {sourceFiles.length} file{sourceFiles.length !== 1 ? "s" : ""} attached
          </span>
        )}
      </div>
    </form>
  );
}
