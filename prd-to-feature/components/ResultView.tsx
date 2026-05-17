"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { downloadZip } from "@/lib/downloadZip";

type Props = {
  design: string;
  files: { path: string; content: string; isModified?: boolean }[];
  preview: string;
  mockups?: string[];
};

type TabId = "preview" | "mockups" | "design" | "code";

export function ResultView({ design, files, preview, mockups = [] }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [selectedFile, setSelectedFile] = useState<string | null>(
    files[0]?.path ?? null
  );
  const [copied, setCopied] = useState(false);
  const [zoomedMockup, setZoomedMockup] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const hasModifiedFiles = files.some((f) => f.isModified);
  const selectedContent = files.find((f) => f.path === selectedFile)?.content ?? "";

  const handleDownloadZip = () => downloadZip(design, files);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMockups = () => {
    mockups.forEach((dataUrl, i) => {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `mockup-${i + 1}.png`;
      link.click();
    });
  };

  const getFileIcon = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext === "ts" || ext === "tsx") return <span className="text-[10px] font-bold text-blue-400 font-mono shrink-0">TS</span>;
    if (ext === "js" || ext === "jsx") return <span className="text-[10px] font-bold text-yellow-400 font-mono shrink-0">JS</span>;
    if (ext === "css" || ext === "scss") return <span className="text-[10px] font-bold text-pink-400 font-mono shrink-0">CSS</span>;
    if (ext === "json") return <span className="text-[10px] font-bold text-amber-400 font-mono shrink-0">JSON</span>;
    if (ext === "md" || ext === "markdown") return <span className="text-[10px] font-bold text-slate-400 font-mono shrink-0">MD</span>;
    return <span className="text-[10px] font-bold text-slate-400 font-mono shrink-0">TXT</span>;
  };

  const previewWidths: Record<typeof previewSize, string> = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  };

  const tabs: { id: TabId; label: string; badge?: string | number; hidden?: boolean }[] = [
    { id: "preview", label: "Preview" },
    { id: "mockups", label: "Mockups", badge: mockups.length > 0 ? mockups.length : undefined, hidden: mockups.length === 0 },
    { id: "design", label: "Design Spec" },
    { id: "code", label: "Code", badge: files.length > 0 ? files.length : undefined },
  ];

  return (
    <div className="overflow-hidden">
      {/* Tab bar */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80">
        <div className="flex items-center justify-between px-2 sm:px-4">
          <div className="flex overflow-x-auto">
            {tabs.filter((t) => !t.hidden).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                  activeTab === tab.id
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {tab.id === "preview" && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                {tab.id === "mockups" && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 001.5 1.5z" />
                  </svg>
                )}
                {tab.id === "design" && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                )}
                {tab.id === "code" && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                )}
                {tab.label}
                {tab.badge !== undefined && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                    {tab.badge}
                  </span>
                )}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm shrink-0 ml-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span className="hidden sm:inline">Download ZIP</span>
            <span className="sm:hidden">ZIP</span>
          </button>
        </div>
      </div>

      {/* Preview tab */}
      {activeTab === "preview" && (
        <div className="bg-slate-100 dark:bg-slate-900">
          <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Live Preview</span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              {(["desktop", "tablet", "mobile"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPreviewSize(size)}
                  title={size.charAt(0).toUpperCase() + size.slice(1)}
                  className={`p-1.5 rounded-md transition-all ${
                    previewSize === size
                      ? "bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  {size === "desktop" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                    </svg>
                  )}
                  {size === "tablet" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  )}
                  {size === "mobile" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 sm:p-6 flex justify-center">
            {preview && preview.length > 100 ? (
              <div
                className="rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 bg-white transition-all duration-300"
                style={{ width: previewWidths[previewSize], maxWidth: "100%" }}
              >
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-2">
                    <div className="bg-white dark:bg-slate-700 rounded-md px-3 py-1 text-xs text-slate-400 dark:text-slate-400 text-center border border-slate-200 dark:border-slate-600 truncate">
                      Feature Preview
                    </div>
                  </div>
                </div>
                <iframe
                  srcDoc={preview}
                  title="Feature preview"
                  className="w-full border-0"
                  style={{ height: "600px" }}
                  sandbox="allow-scripts"
                />
              </div>
            ) : (
              <div className="w-full p-10 text-center text-slate-500 dark:text-slate-400 space-y-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <svg className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-base font-medium">Preview generation failed</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                  The AI couldn&apos;t generate a valid HTML preview this time. Check the{" "}
                  <button type="button" onClick={() => setActiveTab("design")} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 underline font-medium">
                    Design Spec
                  </button>{" "}
                  and{" "}
                  <button type="button" onClick={() => setActiveTab("mockups")} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 underline font-medium">
                    Mockups
                  </button>{" "}
                  tabs for layouts and visuals.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mockups tab */}
      {activeTab === "mockups" && (
        <div className="p-5 sm:p-6 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 001.5 1.5z" />
              </svg>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Design Mockups</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500">· AI-generated visuals</span>
            </div>
            {mockups.length > 0 && (
              <button type="button" onClick={handleDownloadMockups} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download All
              </button>
            )}
          </div>

          {mockups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockups.map((dataUrl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setZoomedMockup(dataUrl)}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-xl transition-all duration-200 bg-white dark:bg-slate-800 cursor-zoom-in hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Mockup {i + 1}{i === 0 ? " — Main Screen" : " — Interaction State"}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                      </svg>
                      Click to zoom
                    </span>
                  </div>
                  <img src={dataUrl} alt={`Design mockup ${i + 1}`} className="w-full h-auto" />
                  <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors" />
                </button>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-slate-500 dark:text-slate-400 space-y-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <svg className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 001.5 1.5z" />
              </svg>
              <p className="text-base font-medium">No mockups generated</p>
              <p className="text-sm">Mockup generation was not available for this request.</p>
            </div>
          )}

          {zoomedMockup && (
            <div
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setZoomedMockup(null)}
            >
              <div className="relative max-w-5xl max-h-[90vh] w-full">
                <button
                  type="button"
                  onClick={() => setZoomedMockup(null)}
                  className="absolute -top-11 right-0 flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                </button>
                <img src={zoomedMockup} alt="Zoomed mockup" className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Design tab */}
      {activeTab === "design" && (
        <div className="p-5 sm:p-6 max-h-[70vh] overflow-auto bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Design Specification</h2>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(design)}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Copy Markdown
            </button>
          </div>
          <article className="prose prose-slate prose-sm prose-headings:text-slate-800 prose-a:text-indigo-600 prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:rounded prose-code:px-1 prose-code:text-xs prose-hr:border-slate-200 prose-pre:bg-slate-100 prose-pre:text-slate-800 max-w-none">
            <ReactMarkdown>{design}</ReactMarkdown>
          </article>
        </div>
      )}

      {/* Code tab */}
      {activeTab === "code" && (
        <div className="flex min-h-[500px] max-h-[72vh]">
          <div className="w-56 border-r border-slate-700 overflow-hidden bg-slate-800 flex flex-col shrink-0">
            <div className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-700 flex items-center justify-between">
              <span>Explorer</span>
              <span className="text-slate-600">{files.length} files</span>
            </div>
            <div className="p-1.5 flex-1 overflow-auto">
              {files.length === 0 ? (
                <p className="text-slate-500 text-sm px-2 py-2">No files generated</p>
              ) : (
                files.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedFile(f.path)}
                    className={`flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-md text-xs truncate transition-colors group ${
                      selectedFile === f.path
                        ? "bg-indigo-600/20 text-indigo-300"
                        : "text-slate-400 hover:bg-slate-700/60 hover:text-slate-200"
                    }`}
                    title={f.path}
                  >
                    {getFileIcon(f.path)}
                    <span className="truncate flex-1 font-mono">{f.path}</span>
                    {hasModifiedFiles && (
                      <span className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded ${
                        f.isModified ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                      }`}>
                        {f.isModified ? "MOD" : "NEW"}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 min-w-0">
            {selectedFile && (
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex gap-1 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                  </div>
                  <span className="text-xs text-slate-300 font-mono truncate">{selectedFile}</span>
                  {hasModifiedFiles && (() => {
                    const file = files.find((f) => f.path === selectedFile);
                    if (!file) return null;
                    return (
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        file.isModified ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {file.isModified ? "Modified" : "New file"}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-slate-600 hidden sm:block">{selectedContent.split("\n").length} lines</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-md hover:bg-slate-700 ml-1"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-auto">
              {selectedFile ? (
                <table className="w-full text-sm font-mono border-collapse">
                  <tbody>
                    {selectedContent.split("\n").map((line, i) => (
                      <tr key={i} className="hover:bg-white/[0.03]">
                        <td className="w-12 text-right pr-4 pl-3 py-0 text-slate-600 select-none text-xs leading-6 align-top border-r border-slate-800 sticky left-0 bg-slate-900">
                          {i + 1}
                        </td>
                        <td className="pl-4 pr-6 py-0 text-slate-200 whitespace-pre leading-6 text-xs">
                          {line || " "}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-500 text-sm">Select a file to view its contents</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
