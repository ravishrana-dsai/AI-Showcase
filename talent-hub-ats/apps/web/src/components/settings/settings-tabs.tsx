"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  UserPlus,
  Database,
  GitBranch,
  FormInput,
  FileText,
  Mail,
  MessageSquare,
  Webhook,
  Key,
  Plug,
  ShieldCheck,
  Scale,
  ScrollText,
  Eye,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TAB_PARAM = "tab";

type TabKey = "general" | "hiring" | "integrations" | "compliance";

interface TabDefinition {
  readonly key: TabKey;
  readonly label: string;
}

interface SettingsCard {
  readonly name: string;
  readonly description: string;
  readonly href: string;
  readonly icon: LucideIcon;
}

const TABS: readonly TabDefinition[] = [
  { key: "general", label: "General" },
  { key: "hiring", label: "Hiring Setup" },
  { key: "integrations", label: "Integrations" },
  { key: "compliance", label: "Compliance" },
] as const;

const CARDS_BY_TAB: Record<TabKey, readonly SettingsCard[]> = {
  general: [
    {
      name: "Organization",
      description: "Manage company profile and branding",
      href: "/dashboard/settings/organization",
      icon: Building2,
    },
    {
      name: "Team Members",
      description: "Invite and manage team members",
      href: "/dashboard/settings/team",
      icon: UserPlus,
    },
    {
      name: "Demo Data",
      description: "Manage demo/seed data for testing",
      href: "/dashboard/settings/demo-data",
      icon: Database,
    },
    {
      name: "Career Page",
      description: "Customize your public careers site",
      href: "/dashboard/settings/career-page",
      icon: Globe,
    },
  ],
  hiring: [
    {
      name: "Pipeline Templates",
      description: "Configure hiring pipeline stages",
      href: "/dashboard/settings/pipeline-templates",
      icon: GitBranch,
    },
    {
      name: "Custom Fields",
      description: "Add custom fields to candidates and jobs",
      href: "/dashboard/settings/custom-fields",
      icon: FormInput,
    },
    {
      name: "JD Template",
      description: "Customize job description templates",
      href: "/dashboard/settings/job-description-template",
      icon: FileText,
    },
    {
      name: "Email Templates",
      description: "Manage automated email templates",
      href: "/dashboard/settings/emails",
      icon: Mail,
    },
    {
      name: "Interview Feedback Options",
      description: "Configure feedback form options",
      href: "/dashboard/settings/interview-feedback-options",
      icon: MessageSquare,
    },
  ],
  integrations: [
    {
      name: "Webhooks",
      description: "Configure webhook endpoints",
      href: "/dashboard/settings/webhooks",
      icon: Webhook,
    },
    {
      name: "API Keys",
      description: "Manage API keys for integrations",
      href: "/dashboard/settings/api-keys",
      icon: Key,
    },
    {
      name: "Integrations",
      description: "Connect third-party services",
      href: "/dashboard/settings/integrations",
      icon: Plug,
    },
    {
      name: "SSO",
      description: "Single sign-on configuration",
      href: "/dashboard/settings/sso",
      icon: ShieldCheck,
    },
  ],
  compliance: [
    {
      name: "Compliance & Reporting",
      description: "Compliance settings and reports",
      href: "/dashboard/settings/compliance",
      icon: Scale,
    },
    {
      name: "Audit Log",
      description: "View system audit trail",
      href: "/dashboard/settings/audit-log",
      icon: ScrollText,
    },
    {
      name: "Field Visibility",
      description: "Control field visibility by role",
      href: "/dashboard/settings/visibility",
      icon: Eye,
    },
  ],
};

function isValidTab(value: string | null): value is TabKey {
  return (
    value === "general" ||
    value === "hiring" ||
    value === "integrations" ||
    value === "compliance"
  );
}

function SettingsTabsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawTab = searchParams.get(TAB_PARAM);
  const activeTab: TabKey = isValidTab(rawTab) ? rawTab : "general";

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "general") {
        params.delete(TAB_PARAM);
      } else {
        params.set(TAB_PARAM, tab);
      }
      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [searchParams, router]
  );

  const cards = CARDS_BY_TAB[activeTab];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-xl border bg-card p-5 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm leading-tight">
                    {card.name}
                  </h3>
                  <p className="text-muted-foreground text-xs mt-1">
                    {card.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsTabs() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-10 w-96 rounded-xl bg-muted/50 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card p-5 h-20 animate-pulse"
              />
            ))}
          </div>
        </div>
      }
    >
      <SettingsTabsContent />
    </Suspense>
  );
}
