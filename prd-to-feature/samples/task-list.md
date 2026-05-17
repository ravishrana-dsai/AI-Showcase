# PRD: Task List for Project Dashboard

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
- Filtering or sorting the list
