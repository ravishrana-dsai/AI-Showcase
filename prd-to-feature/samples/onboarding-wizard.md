# PRD: User Onboarding Wizard

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
- Integration setup (connecting third-party tools)
