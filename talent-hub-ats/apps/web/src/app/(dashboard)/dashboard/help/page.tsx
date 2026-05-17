import { requireAuth } from "@/lib/get-session";
import {
  Briefcase,
  Users,
  Upload,
  Calendar,
  FileText,
  BarChart3,
  ShieldCheck,
  ClipboardList,
  Settings,
  ArrowRight,
  CheckCircle,
  Lightbulb,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Role = string;

const ALL_ROLES: Role[] = [
  "SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER", "HIRING_MANAGER", "INTERVIEWER",
];
const ALL_EXCEPT_INTERVIEWER: Role[] = [
  "SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER", "HIRING_MANAGER",
];
const ADMIN_RECRUITER: Role[] = ["SUPER_ADMIN", "ADMIN", "RECRUITER"];
const ADMINS_ONLY: Role[] = ["SUPER_ADMIN", "ADMIN"];
const UPLOAD_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER"];

const ROLE_TO_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  RECRUITER: "Recruiter",
  SUB_RECRUITER: "Sub-Recruiter",
  HIRING_MANAGER: "Hiring Manager",
  INTERVIEWER: "Interviewer",
  LIMITED: "Limited",
};

interface Section {
  icon: LucideIcon;
  title: string;
  color: string;
  bgColor: string;
  roles: Role[];
  steps: string[];
}

interface QuickStartItem {
  text: string;
  href: string;
  roles: Role[];
}

const sections: Section[] = [
  {
    icon: Briefcase,
    title: "Jobs",
    color: "text-info",
    bgColor: "bg-info/10",
    roles: ALL_EXCEPT_INTERVIEWER,
    steps: [
      "Go to Jobs from the sidebar to see all job postings.",
      "Click \"Create Job\" to add a new position with title, description, department, location, and salary range.",
      "Each job gets its own customizable pipeline (e.g., New > Screen > Interview > Offer > Hired).",
      "Jobs go through statuses: Draft > Pending Approval > Open > Closed.",
      "Click any job to see its pipeline board with candidates in each stage.",
    ],
  },
  {
    icon: Users,
    title: "Candidates",
    color: "text-success",
    bgColor: "bg-success/10",
    roles: ALL_EXCEPT_INTERVIEWER,
    steps: [
      "Go to Candidates from the sidebar to browse your talent pool.",
      "Click \"Add Candidate\" to manually create a profile with name, email, phone, and current role.",
      "Click any candidate row to view their full profile: contact info, applications, interviews, scorecards, and notes.",
      "Use the search bar to find candidates by name, email, or company.",
      "Tag candidates (e.g., \"Strong Candidate\", \"Referred\") for easy filtering.",
    ],
  },
  {
    icon: Upload,
    title: "Upload CVs (Bulk Sourcing)",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    roles: UPLOAD_ROLES,
    steps: [
      "Click \"Upload CVs\" on the dashboard or \"Bulk Upload CVs\" on the Candidates page.",
      "Drag and drop one or multiple resume files (PDF, DOCX, DOC, or TXT).",
      "The system automatically parses each resume to extract: name, email, phone, LinkedIn, skills, and experience.",
      "New candidate profiles are created automatically. Duplicates are detected by email and the resume is attached instead.",
      "You can also upload a resume directly on a candidate's profile page by clicking \"Upload Resume\" in the Documents section.",
    ],
  },
  {
    icon: Calendar,
    title: "Interviews",
    color: "text-warning",
    bgColor: "bg-warning/10",
    roles: ALL_ROLES,
    steps: [
      "Go to Interviews from the sidebar to see all upcoming and scheduled interviews.",
      "Interviews are linked to specific applications (candidate + job).",
      "Each interview has a type (Phone, Video, In-Person, Take-Home), scheduled time, duration, and panel of interviewers.",
      "After an interview, interviewers submit scorecards with ratings (Strong No to Strong Yes) and written feedback.",
      "Scorecards appear on the candidate's profile under their application.",
    ],
  },
  {
    icon: FileText,
    title: "Offers",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    roles: ADMIN_RECRUITER,
    steps: [
      "Go to Offers from the sidebar to track all candidate offers.",
      "Offers include: job title, salary, currency, pay period, equity, bonus, and start date.",
      "Offers follow an approval workflow: Draft > Pending Approval > Approved > Sent > Accepted/Declined.",
      "Each offer is linked to a specific application so you can trace the full hiring journey.",
    ],
  },
  {
    icon: ClipboardList,
    title: "Requisitions",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    roles: ADMIN_RECRUITER,
    steps: [
      "Go to Requisitions from the sidebar to manage headcount requests.",
      "Create a requisition with title, department, headcount, priority, salary range, and justification.",
      "Requisitions go through approval workflows before jobs can be opened against them.",
      "Link one or more jobs to an approved requisition to track fulfillment.",
    ],
  },
  {
    icon: BarChart3,
    title: "Analytics",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    roles: ADMIN_RECRUITER,
    steps: [
      "Go to Analytics from the sidebar for hiring pipeline insights.",
      "Pipeline Overview shows the breakdown of applications by status (Active, Hired, Rejected, etc.).",
      "Source Effectiveness shows which channels (LinkedIn, Referral, Career Page, etc.) bring the most candidates.",
      "Most Active Jobs ranks your open positions by application volume.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Compliance & Reporting",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    roles: ADMIN_RECRUITER,
    steps: [
      "Click \"Compliance & Reporting\" on the dashboard or go to Settings > Compliance.",
      "EEO/EEOC Reports: View anonymized, aggregated demographic data (gender, race, ethnicity, veteran status, disability) for OFCCP compliance.",
      "GPlayer Rating Data Deletion: Search for a candidate and permanently delete all their data. Type their email to confirm. An audit log entry is created.",
      "Audit Trail: View a log of all tracked actions (candidate creation, resume uploads, data deletions) with timestamps and actor info.",
      "EEO data is collected separately from hiring decisions and never shown to interviewers or hiring managers.",
    ],
  },
  {
    icon: Settings,
    title: "Settings (Super Admin only)",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    roles: ADMINS_ONLY,
    steps: [
      "Go to Settings from the sidebar (visible to Super Admin and Admin roles only).",
      "Organization: Update company name, logo, website, and general settings.",
      "Team Members: Invite new users and assign roles. Super Admin can also reset any user's password from the edit panel.",
      "Email Templates: Configure templates for candidate communication (application received, interview invite, rejection, offer).",
      "Webhooks & API Keys: Set up integrations with external tools.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Account Settings",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    roles: ALL_ROLES,
    steps: [
      "Click the key icon next to your name at the bottom of the sidebar to open Account Settings.",
      "Change your own password by entering your current password and a new one (min 8 characters).",
      "Super Admin can also reset any team member's password from Settings > Team Members — click the edit (pencil) icon on any member.",
    ],
  },
];

const quickStartLinks: QuickStartItem[] = [
  { text: "Add new team members and set their passwords", href: "/dashboard/settings/team", roles: ["SUPER_ADMIN"] },
  { text: "Create a Job posting with description and requirements", href: "/dashboard/jobs", roles: ALL_EXCEPT_INTERVIEWER },
  { text: "Upload CVs or add candidates manually to your talent pool", href: "/dashboard/candidates/upload", roles: UPLOAD_ROLES },
  { text: "Move candidates through pipeline stages as they progress", href: "/dashboard/candidates", roles: ALL_EXCEPT_INTERVIEWER },
  { text: "Schedule interviews, collect scorecards, and extend offers", href: "/dashboard/interviews", roles: ALL_ROLES },
  { text: "Change your account password", href: "/dashboard/settings/account", roles: ALL_ROLES },
];

const roleRows = [
  { role: "Super Admin", key: "SUPER_ADMIN", jobs: "Full", candidates: "Full", interviews: "Full", offers: "Full", settings: "Full" },
  { role: "Admin", key: "ADMIN", jobs: "Full", candidates: "Full", interviews: "Full", offers: "Full", settings: "Full" },
  { role: "Recruiter", key: "RECRUITER", jobs: "Create/Edit", candidates: "Full", interviews: "Schedule", offers: "Create/Send", settings: "None" },
  { role: "Sub-Recruiter", key: "SUB_RECRUITER", jobs: "Assigned Only", candidates: "Assigned Jobs", interviews: "Assigned Jobs", offers: "None", settings: "None" },
  { role: "Hiring Manager", key: "HIRING_MANAGER", jobs: "Own Jobs", candidates: "Own Jobs", interviews: "Feedback", offers: "None", settings: "None" },
  { role: "Interviewer", key: "INTERVIEWER", jobs: "None", candidates: "None", interviews: "Feedback", offers: "None", settings: "None" },
  { role: "Limited", key: "LIMITED", jobs: "View", candidates: "None", interviews: "None", offers: "None", settings: "None" },
];

export default async function HelpPage() {
  const user = await requireAuth();

  const visibleSections = sections.filter((s) => s.roles.includes(user.role));
  const visibleQuickStart = quickStartLinks.filter((link) => link.roles.includes(user.role));

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">How to Use [Company] AI</h1>
        <p className="text-muted-foreground mt-1">
          A step-by-step guide to managing your hiring pipeline from sourcing to
          offer.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Showing guide for: <span className="font-medium text-foreground">{ROLE_TO_LABEL[user.role] ?? user.role}</span>
        </p>
      </div>

      {/* Quick Start */}
      {visibleQuickStart.length > 0 && (
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Quick Start</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleQuickStart.map((item, idx) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  {idx + 1}
                </div>
                <p className="text-sm flex-1">{item.text}</p>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Role Permissions - visible to Super Admin, Admin, Recruiter */}
      {["SUPER_ADMIN", "ADMIN", "RECRUITER"].includes(user.role) && (
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">User Roles</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 pr-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Jobs</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Candidates</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Interviews</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Offers</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {roleRows.map((row) => {
                const isCurrentRole = row.key === user.role;
                return (
                  <tr
                    key={row.role}
                    className={isCurrentRole ? "bg-primary/5 ring-1 ring-primary/20 rounded" : ""}
                  >
                    <td className="py-2 pr-4 font-medium">
                      {row.role}
                      {isCurrentRole && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">
                          You
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{row.jobs}</td>
                    <td className="py-2 px-3 text-muted-foreground">{row.candidates}</td>
                    <td className="py-2 px-3 text-muted-foreground">{row.interviews}</td>
                    <td className="py-2 px-3 text-muted-foreground">{row.offers}</td>
                    <td className="py-2 px-3 text-muted-foreground">{row.settings}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Feature Sections */}
      <div className="space-y-4">
        {visibleSections.map((section) => (
          <details
            key={section.title}
            className="bg-card rounded-xl border group"
          >
            <summary className="flex items-center gap-4 p-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <div
                className={`w-10 h-10 rounded-lg ${section.bgColor} ${section.color} flex items-center justify-center shrink-0`}
              >
                <section.icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold flex-1">{section.title}</h3>
              <ArrowRight className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="px-5 pb-5 pt-0">
              <ol className="space-y-3 ml-14">
                {section.steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <p className="text-sm leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
