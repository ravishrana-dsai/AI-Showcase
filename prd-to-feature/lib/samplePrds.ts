export type SamplePrd = {
  id: string;
  title: string;
  description: string;
  content: string;
};

export const samplePrds: SamplePrd[] = [
  {
    id: "task-list",
    title: "Task List",
    description: "Task management for a project dashboard",
    content: `# PRD: Task List for Project Dashboard

## Problem
Project managers need a simple way to track tasks per project. Today they use spreadsheets or external tools; we want an in-app task list so they can view and add tasks without leaving the dashboard.

## Users
- Project managers who own one or more projects
- Team members who need to see what's assigned to them

## Goals
- Show a list of tasks for the current project (title, status, assignee, due date).
- Allow adding a new task (title required; status, assignee, due date optional).
- Support at least: status = Todo | In Progress | Done.

## Acceptance criteria
1. On the project dashboard, a "Tasks" section shows the list of tasks for that project.
2. Each task row shows: title, status, assignee name (or "Unassigned"), due date (or "—" if none).
3. An "Add task" button opens a form with: Title (required), Status (dropdown), Assignee (dropdown of team members), Due date (date picker).
4. Submitting the form adds the task and refreshes the list.
5. Empty state: when there are no tasks, show "No tasks yet. Add one to get started." and the Add task button.

## Out of scope (v1)
- Editing or deleting tasks
- Comments or attachments
- Filtering or sorting the list`,
  },
  {
    id: "user-profile",
    title: "User Profile & Settings",
    description: "Self-service profile page with notifications and security",
    content: `# PRD: User Profile & Settings Page

## Problem
Users currently have no way to view or update their profile information within the app. They must contact support to change their name, email preferences, or avatar. We need a self-service profile page.

## Users
- All authenticated users of the platform
- Admin users who may view (but not edit) other users' profiles

## Goals
- Let users view and edit their personal information (name, bio, avatar).
- Let users manage notification preferences (email, push, SMS toggles).
- Let users change their password securely.
- Provide a clean, organized settings layout with clear sections.

## Acceptance criteria
1. A "Profile" page is accessible from the user menu dropdown in the top-right corner.
2. The page has three sections in a tabbed or sidebar layout: "Profile", "Notifications", "Security".
3. **Profile section**: Shows avatar (with upload/change button), full name, email (read-only), bio (textarea, max 280 chars with character counter). A "Save changes" button persists edits.
4. **Notifications section**: Toggle switches for — Email notifications (on/off), Push notifications (on/off), Weekly digest email (on/off), Marketing emails (on/off). Changes save automatically on toggle.
5. **Security section**: "Change password" form with fields: Current password, New password (min 8 chars, show strength indicator), Confirm new password. A "Update password" button submits the change.
6. Success and error toast notifications appear after any save action.
7. Unsaved changes on the Profile tab trigger a confirmation dialog if the user navigates away.

## Out of scope (v1)
- Two-factor authentication setup
- Account deletion
- Social login connections
- Dark mode / theme preferences`,
  },
  {
    id: "pricing-page",
    title: "Pricing Page",
    description: "Plan comparison with monthly/annual toggle and FAQ",
    content: `# PRD: Pricing Page with Plan Comparison

## Problem
Prospective customers visit our website but have no clear way to compare plans and pricing. The current pricing info is buried in a FAQ page. We need a dedicated pricing page that drives conversions.

## Users
- Prospective customers evaluating the product
- Existing free-tier users considering an upgrade
- Sales team members sharing pricing links with leads

## Goals
- Display all available plans side-by-side with clear feature comparisons.
- Highlight the recommended plan visually.
- Provide a monthly/annual billing toggle with visible savings.
- Include a FAQ section to address common pricing questions.

## Acceptance criteria
1. The page shows 3 plan cards side-by-side: Free, Pro ($19/mo), Enterprise ($49/mo).
2. A toggle switch at the top lets users switch between "Monthly" and "Annual" billing. Annual prices show a "Save 20%" badge.
3. The "Pro" plan card is visually highlighted as "Most Popular" with a distinct border/badge.
4. Each plan card displays: Plan name, Price (with billing period), A list of features with checkmarks or X marks, A CTA button ("Get Started" for Free, "Start Free Trial" for Pro, "Contact Sales" for Enterprise).
5. Below the plan cards, a full feature comparison table shows all features across plans with checkmarks.
6. A FAQ accordion section at the bottom answers at least 5 common questions (e.g., "Can I cancel anytime?", "What payment methods do you accept?").
7. The page is fully responsive — cards stack vertically on mobile.

## Out of scope (v1)
- Actual payment processing or Stripe integration
- Custom enterprise plan builder
- Localized pricing by region`,
  },
  {
    id: "chat-messaging",
    title: "Chat & Messaging",
    description: "Real-time DMs and group channels for team collaboration",
    content: `# PRD: Real-Time Chat & Messaging

## Problem
Team members currently rely on external tools (Slack, email) to communicate about projects. Context gets lost across tools. We need an in-app messaging feature so conversations stay tied to the workspace.

## Users
- Team members who collaborate on shared projects
- Project leads who need to broadcast updates to the team

## Goals
- Provide a real-time chat interface within the app.
- Support both direct messages (1-on-1) and group channels.
- Show online/offline presence indicators.
- Keep the UI minimal and non-intrusive to the main workflow.

## Acceptance criteria
1. A chat icon in the bottom-right corner opens a slide-out chat panel.
2. The panel has two tabs: "Direct Messages" and "Channels".
3. **Direct Messages tab**: Shows a list of recent conversations sorted by most recent message. Each row shows: user avatar, name, last message preview (truncated to 1 line), timestamp, unread count badge.
4. **Channels tab**: Shows a list of channels (e.g., #general, #design, #engineering). Each row shows: channel name, member count, last message preview, unread badge.
5. Clicking a conversation or channel opens the chat view with: Message history (scrollable, newest at bottom), a text input bar at the bottom with send button, each message shows: sender avatar, sender name, message text, timestamp.
6. Messages appear in real-time without page refresh (simulated with optimistic UI).
7. A "New Message" button lets the user start a DM by searching for a team member by name.
8. An "unread" dot appears on the chat icon when there are unread messages.
9. Empty state for new users: "No messages yet. Start a conversation with your team!"

## Out of scope (v1)
- File/image attachments in chat
- Message editing or deletion
- Emoji reactions
- Threaded replies
- Video or voice calls`,
  },
  {
    id: "analytics-dashboard",
    title: "Analytics Dashboard",
    description: "KPI cards, charts, and traffic source breakdown",
    content: `# PRD: Analytics Dashboard

## Problem
Business stakeholders have no visibility into key product metrics without requesting reports from the data team. We need a self-service analytics dashboard that surfaces the most important KPIs at a glance.

## Users
- Product managers tracking feature adoption and engagement
- Executives reviewing high-level business metrics
- Marketing team monitoring acquisition and conversion funnels

## Goals
- Display key metrics in a visually clear, scannable dashboard.
- Support a date range picker for filtering data.
- Show trends over time with charts.
- Allow comparing current period to previous period.

## Acceptance criteria
1. The dashboard page shows a top row of 4 KPI summary cards: Total Users (with % change vs. previous period), Active Users (daily active), Revenue (current period total), Conversion Rate (signup to paid %).
2. Each KPI card shows: metric name, current value, percentage change with green (up) or red (down) arrow, a mini sparkline chart showing the 7-day trend.
3. Below the KPI cards, a large area chart displays "Users Over Time" with the selected date range. The chart has a tooltip on hover showing exact values.
4. A date range picker in the top-right corner lets users select: Last 7 days, Last 30 days, Last 90 days, or a custom date range.
5. Below the main chart, a two-column layout shows: Left — "Top Pages" table (page name, views, avg. time on page) for the top 10 pages. Right — "Traffic Sources" doughnut/pie chart showing source breakdown (Direct, Organic, Referral, Social, Paid).
6. All data is placeholder/mock data for the prototype.
7. The dashboard is responsive — cards and charts stack on smaller screens.

## Out of scope (v1)
- Real data integration or API connections
- Export to PDF/CSV
- Custom dashboard builder (drag-and-drop widgets)
- User-level drill-down views`,
  },
  {
    id: "onboarding-wizard",
    title: "Onboarding Wizard",
    description: "Step-by-step new user setup with progress tracking",
    content: `# PRD: User Onboarding Wizard

## Problem
New users sign up but often drop off before completing setup because there's no guided flow. They land on an empty dashboard with no direction. We need a step-by-step onboarding wizard to help users set up their account and experience the core value quickly.

## Users
- New users who just created an account
- Users who skipped onboarding and want to revisit it

## Goals
- Guide new users through essential setup steps in a friendly, non-overwhelming way.
- Collect necessary information to personalize the user's experience.
- Get users to their "aha moment" (creating their first project) within the onboarding flow.
- Allow users to skip and come back later.

## Acceptance criteria
1. After first login, users are taken to a full-screen onboarding wizard (not a modal — a dedicated page).
2. A progress bar at the top shows completion across all steps (e.g., "Step 2 of 5").
3. **Step 1 — Welcome**: A welcome message with the user's name, a brief description of what the product does, and a "Let's get started" button.
4. **Step 2 — Personal Info**: Form to collect: Role (dropdown: Developer, Designer, PM, Marketing, Other), Company name (text input), Team size (radio buttons: Just me, 2-10, 11-50, 50+). All fields required.
5. **Step 3 — Workspace Setup**: User names their first workspace (text input, pre-filled with "[Company] Workspace"). An optional toggle: "Invite team members" with an email input field that accepts multiple comma-separated emails.
6. **Step 4 — Create First Project**: User creates their first project with: Project name (text input, required), Project description (textarea, optional), Template selection (3 card options: "Blank Project", "Marketing Campaign", "Product Launch" — each with an icon and short description).
7. **Step 5 — Done**: A success / celebration screen with confetti animation, "Your workspace is ready!" heading, a summary of what was set up, and a "Go to Dashboard" button.
8. Each step has "Back" and "Continue" buttons. Step 1 has no Back. Step 5 has no Continue.
9. A "Skip for now" link is available on steps 2-4 (not on 1 or 5).
10. If the user skips, a persistent banner on the dashboard says "Complete your setup" with a link back to the wizard.

## Out of scope (v1)
- Interactive product tour / tooltips on the dashboard after onboarding
- Video walkthroughs embedded in steps
- A/B testing different onboarding flows
- Integration setup (connecting third-party tools)`,
  },
];
