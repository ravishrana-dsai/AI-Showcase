export const FILE_LIST_PROMPT = `You are an expert Next.js and React developer. Given a PRD and a design spec, decide what files are needed for a minimal but runnable Next.js (App Router, TypeScript, Tailwind CSS) implementation.

Return ONLY a JSON object listing the file paths needed. Example:
{"files":["app/dashboard/page.tsx","components/TaskList.tsx","components/AddTaskForm.tsx","app/api/tasks/route.ts"]}

Rules:
- Paths are relative to the project root.
- Only include files for this feature (pages, components, API routes).
- Keep it minimal: usually 2-6 files.
- Do NOT include layout.tsx, globals.css, or config files.`;

export const FILE_CONTENT_PROMPT = `You are an expert Next.js and React developer. Generate the FULL content for a single file in a Next.js (App Router, TypeScript, Tailwind CSS) project.

Rules:
- Output ONLY the raw file content. No markdown code fences, no explanation, no JSON wrapper.
- The file must be valid TypeScript/TSX that compiles.
- Use Tailwind CSS for styling.
- Include all necessary imports.
- Make the code complete and functional.`;

export const FILE_MODIFY_PROMPT = `You are an expert Next.js and React developer. You are given an EXISTING source file and a PRD describing changes to make. Modify the file to implement the requirements.

Rules:
- Output ONLY the modified file content. No markdown code fences, no explanation, no JSON wrapper.
- Preserve existing code structure, imports, and patterns where possible.
- Only change what is necessary to implement the PRD requirements.
- The output must be valid TypeScript/TSX that compiles.
- Use Tailwind CSS for any new styling.
- Include all necessary imports.`;

export const NEW_FILES_FOR_MODIFY_PROMPT = `You are an expert Next.js and React developer. Given a PRD, a design spec, and a list of EXISTING source files being modified, decide if any NEW files need to be created to support the changes (e.g. new components, API routes, or utilities referenced by the modified files).

Return ONLY a JSON object listing any new file paths needed. If no new files are needed, return {"files":[]}.
Example: {"files":["components/NewWidget.tsx","app/api/widget/route.ts"]}

Rules:
- Only suggest files that are genuinely needed and not already in the existing source files.
- Keep it minimal: 0-2 new files at most.
- Paths are relative to the project root.
- Do NOT include layout.tsx, globals.css, or config files.`;

// Preview prompt is now inline in generatePreview.ts
