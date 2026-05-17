# PRD: User Profile & Settings Page

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
- Dark mode / theme preferences
