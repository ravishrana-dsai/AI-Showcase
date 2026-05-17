"use client";

import { useTheme } from "./theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const options: { value: "light" | "dark" | "system"; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme, resolved } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const CurrentIcon = resolved === "dark" ? Moon : Sun;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle theme"
        aria-expanded={open}
        aria-haspopup="true"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[140px] rounded-lg border bg-card py-1 shadow-lg"
          role="menu"
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            const isActive = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  setTheme(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
