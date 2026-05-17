"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

export function DemoDataSwitch({
  initialHideDemo,
}: {
  initialHideDemo: boolean;
}) {
  const router = useRouter();
  const [hideDemo, setHideDemo] = useState(initialHideDemo);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/settings/demo-data"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hideDemoData: !hideDemo }),
      });
      if (res.ok) {
        setHideDemo(!hideDemo);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <span className="text-sm font-medium">Demo data</span>
      <button
        type="button"
        role="switch"
        aria-checked={hideDemo}
        onClick={toggle}
        disabled={loading}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          hideDemo ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
            hideDemo ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
      <span className="text-sm text-muted-foreground">
        {hideDemo ? "Hidden" : "Shown"}
      </span>
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
