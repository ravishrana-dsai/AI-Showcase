"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  FileText,
  BarChart3,
  Settings,
  Building2,
  UserPlus,
  ClipboardList,
  HelpCircle,
  Upload,
  ShieldCheck,
  MessageSquare,
  Globe,
  KeyRound,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@talent-hub/shared";
import { ROLE_LABELS } from "@talent-hub/shared";

interface SidebarProps {
  user: SessionUser;
  orgSlug?: string;
  /** Standalone careers app origin + path (e.g. http://localhost:3051/careers). */
  careersPublicBaseUrl: string;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Requisitions", href: "/dashboard/requisitions", icon: ClipboardList },
  { name: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
  { name: "Candidates", href: "/dashboard/candidates", icon: Users },
  { name: "Interviews", href: "/dashboard/interviews", icon: Calendar },
  { name: "My Interviews", href: "/dashboard/my-interviews", icon: MessageSquare },
  { name: "Offers", href: "/dashboard/offers", icon: FileText },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "How to Use", href: "/dashboard/help", icon: HelpCircle },
];

const adminNavigation = [
  { name: "Team", href: "/dashboard/settings/team", icon: UserPlus },
  { name: "Organization", href: "/dashboard/settings/organization", icon: Building2 },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

const hiringManagerNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
  { name: "Candidates", href: "/dashboard/candidates", icon: Users },
  { name: "Interviews", href: "/dashboard/interviews", icon: Calendar },
  { name: "My Interviews", href: "/dashboard/my-interviews", icon: MessageSquare },
  { name: "How to Use", href: "/dashboard/help", icon: HelpCircle },
];

const interviewerNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Interviews", href: "/dashboard/my-interviews", icon: MessageSquare },
  { name: "How to Use", href: "/dashboard/help", icon: HelpCircle },
];

export function Sidebar({ user, orgSlug, careersPublicBaseUrl }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user.role);
  const isRecruiter = user.role === "RECRUITER";
  const isHiringManager = user.role === "HIRING_MANAGER";
  const isInterviewerOnly = ["INTERVIEWER", "LIMITED"].includes(user.role);

  const navItems = isInterviewerOnly
    ? interviewerNavigation
    : isHiringManager
      ? hiringManagerNavigation
      : navigation;

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-card sticky top-0">
      {/* Brand */}
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden bg-[#09000f] shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/[Company] logo purple.png`} alt="[Company] AI" className="h-7 w-7 object-contain" />
          </div>
          <span className="font-semibold text-base">[Company] AI</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        <div className="mb-2 px-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isInterviewerOnly
              ? "Interviewer"
              : isHiringManager
                ? "Hiring Manager"
                : "Recruiting"}
          </p>
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0 opacity-90" />
              {item.name}
            </Link>
          );
        })}

        {isAdmin && !isInterviewerOnly && (
          <>
            <div className="mt-6 mb-2 px-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Administration
              </p>
            </div>
            {adminNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}

        {isRecruiter && !isAdmin && (
          <>
            <div className="mt-6 mb-2 px-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Management
              </p>
            </div>
            <Link
              href="/dashboard/settings/visibility"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                pathname.startsWith("/dashboard/settings/visibility")
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4 shrink-0 opacity-90" />
              Field Visibility
            </Link>
          </>
        )}
      </nav>

      {/* Quick links — hidden for interviewer and hiring manager roles */}
      {!isInterviewerOnly && !isHiringManager && (
        <div className="space-y-0.5 border-t px-2 py-3">
          <Link
            href="/dashboard/agent"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              pathname.startsWith("/dashboard/agent")
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Bot className="h-4 w-4 shrink-0 opacity-90" />
            Agent
          </Link>
          <Link
            href={
              orgSlug
                ? `${careersPublicBaseUrl.replace(/\/$/, "")}/${orgSlug}`
                : `${careersPublicBaseUrl.replace(/\/$/, "")}/jobs`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Globe className="h-4 w-4 shrink-0 opacity-90" />
            Career site
          </Link>
          <Link
            href="/dashboard/candidates/upload"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              pathname === "/dashboard/candidates/upload"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Upload className="h-4 w-4 shrink-0 opacity-90" />
            Upload CVs
          </Link>
          <Link
            href="/dashboard/settings/compliance"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              pathname.startsWith("/dashboard/settings/compliance")
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ShieldCheck className="h-4 w-4 shrink-0 opacity-90" />
            Compliance & Reporting
          </Link>
        </div>
      )}

      {/* User block */}
      <div className="border-t bg-muted/30 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {user.name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </div>
          <Link
            href="/dashboard/settings/account"
            title="Account Settings"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <KeyRound className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
