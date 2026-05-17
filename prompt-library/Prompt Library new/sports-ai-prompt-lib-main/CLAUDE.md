# CLAUDE.md — Sports AI Prompt Library

## Project Overview

A Next.js 16 web app: a searchable, filterable library of high-quality LLM prompts. Users browse prompts, generate AI-crafted prompts via Google Gemini, and submit new prompts for review.

## Dev Server

```bash
cd prompt-library
npm run dev
# Runs at http://127.0.0.1:4000
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | 16.1.6 |
| Language | TypeScript | 5.x |
| UI | React | 19.2.3 |
| Styling | Tailwind CSS | 4.x |
| AI | Google Gemini (`@google/genai`) | 1.41.0+ |
| AI Model | `gemini-2.5-flash` | |

## Project Structure

All source lives under `prompt-library/`:

```
prompt-library/
├── public/prompt_library.json      # Main prompt database
├── data/submissions.json           # User-submitted prompts (server-side)
├── src/
│   ├── app/
│   │   ├── globals.css             # Tailwind + custom CSS (theme, glass, gradients)
│   │   ├── layout.tsx              # Root layout, dark mode init script
│   │   ├── page.tsx                # Server component — reads JSON, renders ClientPage
│   │   └── api/
│   │       ├── prompts/route.ts    # GET — full prompt library (memory-cached)
│   │       ├── generate/route.ts   # POST — Gemini AI generation
│   │       └── submissions/route.ts # GET/POST — user submissions
│   ├── components/
│   │   ├── ClientPage.tsx          # Main 'use client' orchestrator
│   │   ├── Header.tsx
│   │   ├── TabBar.tsx
│   │   ├── browse/                 # SearchBar, FilterPanel, PromptCard, PromptDetail, PromptGrid, CopyButton
│   │   ├── generator/              # PromptGenerator
│   │   └── submit/                 # SubmitForm, ArrayInput
│   ├── hooks/
│   │   ├── useClipboard.ts
│   │   └── useDebounce.ts          # 300ms debounce on search
│   └── lib/
│       ├── types.ts                # All TS interfaces
│       ├── constants.ts            # Categories, complexities, LLMs, color maps
│       ├── search.ts               # Search index builder + relevance scorer
│       ├── validation.ts           # Submission form validation
│       └── idGenerator.ts          # Sequential IDs (SUB-001, SUB-002...)
```

## Key Architecture Decisions

1. **Server/Client boundary:** `page.tsx` is a server component that reads the JSON file. `ClientPage.tsx` (`'use client'`) is the interactivity root.
2. **No database:** Prompts live in `public/prompt_library.json` (static). Submissions are written to `data/submissions.json` via the filesystem.
3. **Dark mode:** An inline `<script>` in `<head>` reads `localStorage` before React hydrates to prevent theme flash.
4. **Parallel AI + search:** Prompt Generator fires local search and Gemini API simultaneously.
5. **CSS specificity:** Custom glass/gradient utilities use `!important` because Tailwind 4 utilities can override them. Never add Tailwind border classes alongside `.glass`.
6. **Gemini output:** Uses `responseMimeType: 'application/json'` + `responseSchema` for reliable parsing. Fallback parser handles markdown code fences.

## Data Model

```typescript
interface Prompt {
  prompt_id: string;           // e.g. "WRT-001", "ANA-003"
  title: string;
  primary_use_case: string;
  secondary_use_cases: string[];
  user_role: string;
  industry: string;
  category: Category;          // "Writing" | "Analysis" | "Coding" | "Reasoning" | "Automation" | "Ideation" | "Marketing" | "Social Media" | "Ads" | "Image Creator" | "Graphic Design"
  complexity: Complexity;      // "Beginner" | "Intermediate" | "Advanced"
  supported_llms: LLM[];       // "Claude" | "GPT-4" | "GPT-5" | "Gemini" | "Llama"
  output_type: string;
  prompt_text: string;
  variations: { short: string; detailed: string; strict: string };
  tips: string;
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |

Stored in `prompt-library/.env.local` (gitignored).

## Search & Scoring

- Full-text search: all fields concatenated into `_searchText`, AND logic on terms.
- Relevance scoring weights: `title`=10, `primary_use_case`=8, `secondary_use_cases`=6, `category`=5, `user_role`=4, `industry`=4, `output_type`=3, `prompt_text`=1, `tips`=1.

## UI Design System

**Theme:** Purple-blue gradient with glass-morphism.

| Custom Class | Purpose |
|-------------|---------|
| `.glass` | Glass card (blur 16px, semi-transparent bg) |
| `.glass-strong` | Stronger glass (blur 24px) for header/tabs |
| `.btn-gradient` | Purple to blue gradient button |
| `.text-gradient` | Gradient text via background-clip |
| `.glow-hover` | Lift + purple glow on hover |
| `.glow-purple` | Static purple glow (AI section) |
| `.input-glow` | Focus ring with purple glow |

## Prompt ID Format

- Library prompts: category prefix (`WRT-001`, `ANA-003`, `COD-005`)
- Submissions: `SUB-001`, `SUB-002`, ...

## No Auth

The app has no authentication. All API routes are open.
