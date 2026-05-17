"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";

type ImportType = "courts" | "requests";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>("courts");
  const [jsonInput, setJsonInput] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ data: ImportResult; dryRun: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setLoading(true);
    setResult(null);
    setError(null);

    let rows: unknown[];
    try {
      rows = JSON.parse(jsonInput);
      if (!Array.isArray(rows)) throw new Error("Input must be a JSON array");
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: importType, rows, dryRun }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Import failed");
    } else {
      setResult(data);
    }
    setLoading(false);
  }

  const courtTemplate = JSON.stringify([
    { name: "Green Park Padel", city: "Mumbai", state: "Maharashtra", partnerName: "Sport Club", surfaceType: "synthetic", totalCourts: 4, externalId: "court_001" },
    { name: "DLF Padel Arena", city: "Delhi", state: "Delhi", partnerName: "DLF Sports", surfaceType: "clay", totalCourts: 2, externalId: "court_002" },
  ], null, 2);

  const requestTemplate = JSON.stringify([
    { externalId: "req_001", courtExternalId: "court_001", playerName: "Rahul Sharma", matchDate: "2024-01-15", status: "COMPLETED" },
    { externalId: "req_002", courtName: "Green Park Padel", playerName: "Priya Singh", matchDate: "2024-01-16", status: "IN_PROGRESS" },
  ], null, 2);

  return (
    <div>
      <Topbar title="Import Data" subtitle="Migrate from Google Sheets / CSV exports" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Import Form */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-gray-400" />Paste JSON Data</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setImportType("courts")}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                      importType === "courts" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Courts
                  </button>
                  <button
                    onClick={() => setImportType("requests")}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                      importType === "requests" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Requests
                  </button>
                </div>

                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={`Paste your JSON array here...\n\nExample:\n${importType === "courts" ? courtTemplate : requestTemplate}`}
                  className="h-72 w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600"
                    />
                    Dry run (validate only, don&apos;t save)
                  </label>
                  <button
                    onClick={handleImport}
                    disabled={loading || !jsonInput.trim()}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    {loading ? "Importing..." : dryRun ? "Validate" : "Import"}
                  </button>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {result && (
                  <div className={`rounded-lg border p-4 ${result.dryRun ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className={`h-5 w-5 ${result.dryRun ? "text-blue-500" : "text-green-500"}`} />
                      <span className={`font-semibold ${result.dryRun ? "text-blue-700" : "text-green-700"}`}>
                        {result.dryRun ? "Validation complete" : "Import successful"}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className={result.dryRun ? "text-blue-700" : "text-green-700"}>
                        {result.dryRun ? "Would import" : "Imported"}: <strong>{result.data.imported}</strong> rows
                      </p>
                      {result.data.skipped > 0 && (
                        <p className="text-yellow-700">Skipped: <strong>{result.data.skipped}</strong> rows</p>
                      )}
                      {result.data.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium text-red-700">Errors:</p>
                          <ul className="mt-1 space-y-1">
                            {result.data.errors.slice(0, 5).map((e, i) => (
                              <li key={i} className="text-xs text-red-600 font-mono">{e}</li>
                            ))}
                            {result.data.errors.length > 5 && (
                              <li className="text-xs text-red-500">...and {result.data.errors.length - 5} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>How to Import</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                <ol className="space-y-2 list-decimal list-inside">
                  <li>Export your Google Sheet as CSV</li>
                  <li>Convert CSV to JSON array (use <a href="https://csvjson.com/csv2json" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">csvjson.com</a>)</li>
                  <li>Paste the JSON array above</li>
                  <li>Run a dry-run first to validate</li>
                  <li>Uncheck dry-run and import</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Courts Fields</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1 text-xs font-mono">
                  {[
                    { field: "name", req: true },
                    { field: "city", req: true },
                    { field: "state", req: false },
                    { field: "partnerName", req: false },
                    { field: "partnerContact", req: false },
                    { field: "partnerEmail", req: false },
                    { field: "surfaceType", req: false },
                    { field: "totalCourts", req: false },
                    { field: "externalId", req: false },
                    { field: "status", req: false },
                  ].map(({ field, req }) => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-gray-700">{field}</span>
                      {req && <span className="text-red-500 text-xs">required</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Requests Fields</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1 text-xs font-mono">
                  {[
                    { field: "courtExternalId OR courtName", req: true },
                    { field: "externalId", req: false },
                    { field: "playerName", req: false },
                    { field: "playerId", req: false },
                    { field: "matchDate", req: false },
                    { field: "status", req: false },
                    { field: "videoUrl", req: false },
                    { field: "notes", req: false },
                    { field: "assignedTo", req: false },
                  ].map(({ field, req }) => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-gray-700">{field}</span>
                      {req && <span className="text-red-500 text-xs">required</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
