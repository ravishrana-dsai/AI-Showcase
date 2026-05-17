# PRD: Real-Time Chat & Messaging

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
- Video or voice calls
