"use client";

import { signOut } from "next-auth/react";
import { LogOut, Search, User, Briefcase, X, SlidersHorizontal } from "lucide-react";
import type { SessionUser } from "@talent-hub/shared";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AdvancedSearchPanel } from "./advanced-search-panel";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";

interface SearchCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentTitle: string | null;
  currentCompany: string | null;
}

interface SearchJob {
  id: string;
  title: string;
  status: string;
  department: { name: string } | null;
}

interface SearchResults {
  candidates: SearchCandidate[];
  jobs: SearchJob[];
}

interface HeaderProps {
  user: SessionUser;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterCount, setFilterCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        getApiUrl(`/api/search?q=${encodeURIComponent(q)}`)
      );
      if (res.ok) {
        const data: SearchResults = await res.json();
        setResults(data);
        setOpen(true);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || showAdvanced) {
      setResults(null);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch, showAdvanced]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasResults =
    results && (results.candidates.length > 0 || results.jobs.length > 0);

  function navigateTo(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      {/* Search */}
      <div className="flex flex-1 max-w-xl items-center gap-2">
      <div className="flex-1" ref={containerRef}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => hasResults && setOpen(true)}
            placeholder="Search candidates, jobs..."
            aria-label="Search"
            className="h-9 w-full rounded-lg border bg-muted/50 pl-9 pr-8 text-sm placeholder:text-muted-foreground transition-colors focus:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setOpen(false); setResults(null); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Dropdown */}
          {open && (
            <div className="absolute top-full mt-1 w-full rounded-lg border bg-popover shadow-lg z-50 overflow-hidden">
              {loading && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Searching…
                </div>
              )}

              {!loading && !hasResults && query.length >= 2 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  No results for &quot;{query}&quot;
                </div>
              )}

              {!loading && results && results.candidates.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/40 border-b">
                    Candidates
                  </div>
                  {results.candidates.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => navigateTo(`/dashboard/candidates/${c.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.currentTitle
                            ? `${c.currentTitle}${c.currentCompany ? ` · ${c.currentCompany}` : ""}`
                            : c.email}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!loading && results && results.jobs.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/40 border-b border-t">
                    Jobs
                  </div>
                  {results.jobs.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => navigateTo(`/dashboard/jobs/${j.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                        <Briefcase className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{j.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {j.department?.name ?? "No department"} ·{" "}
                          <span className="capitalize">{j.status.toLowerCase()}</span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters button */}
      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
          showAdvanced
            ? "border-primary bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
        aria-label="Toggle advanced filters"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {filterCount > 0 && (
          <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground leading-none">
            {filterCount}
          </span>
        )}
      </button>
      </div>

      {showAdvanced && (
        <AdvancedSearchPanel
          query={query}
          onClose={() => setShowAdvanced(false)}
          onFilterCountChange={setFilterCount}
        />
      )}

      {/* Right */}
      <div className="ml-4 flex items-center gap-1">
        <ThemeToggle />
        <NotificationBell />
        <button
          onClick={() => signOut({ callbackUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login` })}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
