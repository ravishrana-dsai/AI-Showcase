"use client";

import { useState, useEffect } from "react";
import { Calendar, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface Integration {
  id: string;
  provider: string;
  isActive: boolean;
  needsReauth: boolean;
  calendarId: string | null;
  createdAt: string;
}

export function CalendarIntegrationCard() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch(getApiUrl("/api/integrations/calendar/status"))
      .then((r) => r.json())
      .then((data) => setIntegration(data.integration ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch(getApiUrl("/api/integrations/calendar/disconnect"), { method: "POST" });
      setIntegration(null);
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 text-blue-600 rounded-lg p-2">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Google Calendar</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Automatically create calendar events when interviews are scheduled.
            </p>
          </div>
        </div>

        {!loading && (
          <div className="flex items-center gap-3">
            {integration ? (
              integration.needsReauth ? (
                <span className="flex items-center gap-1 text-sm text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                  Re-authentication required
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Connected
                </span>
              )
            ) : (
              <span className="flex items-center gap-1 text-sm text-gray-400">
                <XCircle className="h-4 w-4" />
                Not connected
              </span>
            )}

            {integration ? (
              <div className="flex gap-2">
                {integration.needsReauth && (
                  <a
                    href="/api/integrations/calendar/google/connect"
                    className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Reconnect
                  </a>
                )}
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            ) : (
              <a
                href="/api/integrations/calendar/google/connect"
                className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Connect Google Calendar
              </a>
            )}
          </div>
        )}
      </div>

      {integration && !integration.needsReauth && (
        <p className="text-xs text-gray-400 mt-4">
          Connected since {new Date(integration.createdAt).toLocaleDateString()}. Calendar events will be created on your primary Google Calendar.
        </p>
      )}
    </div>
  );
}
