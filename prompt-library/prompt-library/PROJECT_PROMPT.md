# Prompt Library — Full Project Prompt

## Overview

A **Next.js 16** web application that serves as a searchable, filterable library of high-quality LLM prompts. Users can browse prompts, generate AI-crafted prompts using Google Gemini, and submit new prompts for review. The app features a bold, vibrant UI with glass-morphism effects, gradient accents, and full dark/light theme support.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | 5.x |
| UI Library | React | 19.2.3 |
| Styling | Tailwind CSS | 4.x |
| AI Integration | Google Gemini (`@google/genai`) | 1.41.0+ |
| Model | `gemini-2.5-flash` | — |
| Dev Server | `next dev -H 127.0.0.1 -p 4000` | — |

---

## Project Structure

```
prompt-library/
├── public/
│   └── prompt_library.json          # Main prompt database (JSON array of Prompt objects)
├── data/
│   └── submissions.json             # User-submitted prompts (persisted server-side)
├── src/
│   ├── app/
│   │   ├── globals.css              # Tailwind imports + custom CSS (theme, glass, gradients)
│   │   ├── layout.tsx               # Root layout with fonts, metadata, dark mode script
│   │   ├── page.tsx                 # Server component — reads prompt_library.json, renders ClientPage
│   │   └── api/
│   │       ├── prompts/route.ts     # GET — returns all prompts (cached in memory)
│   │       ├── generate/route.ts    # POST — Gemini AI prompt generation
│   │       └── submissions/route.ts # GET/POST — read & write user submissions
│   ├── components/
│   │   ├── ClientPage.tsx           # Main client orchestrator (tabs, state, routing)
│   │   ├── Header.tsx               # Sticky header with logo + dark/light theme toggle
│   │   ├── TabBar.tsx               # Tab navigation (Browse | Submit | Generator)
│   │   ├── browse/
│   │   │   ├── SearchBar.tsx        # Full-text search input
│   │   │   ├── FilterPanel.tsx      # Category / Complexity / LLM chip filters
│   │   │   ├── PromptCard.tsx       # Individual prompt card in grid
│   │   │   ├── PromptDetail.tsx     # Full prompt modal with variation tabs
│   │   │   ├── PromptGrid.tsx       # Responsive grid layout with pagination
│   │   │   └── CopyButton.tsx       # Clipboard copy with feedback
│   │   ├── generator/
│   │   │   └── PromptGenerator.tsx  # AI generation UI + library match results
│   │   └── submit/
│   │       ├── SubmitForm.tsx       # Full prompt submission form
│   │       └── ArrayInput.tsx       # Dynamic array field (add/remove items)
│   ├── hooks/
│   │   ├── useClipboard.ts         # Clipboard API hook with fallback
│   │   └── useDebounce.ts          # Debounce hook for search input
│   └── lib/
│       ├── types.ts                # All TypeScript types and interfaces
│       ├── constants.ts            # Categories, complexities, LLMs, color maps
│       ├── search.ts               # Search index builder, filter engine, relevance scorer
│       ├── validation.ts           # Submission form validation rules
│       └── idGenerator.ts          # Sequential ID generator for submissions (SUB-001, etc.)
├── .env.local                      # GEMINI_API_KEY (not committed)
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── eslint.config.mjs
```

---

## Data Model

### Prompt (core entity)

```typescript
interface Prompt {
  prompt_id: string;           // e.g. "WRT-001", "ANA-003"
  title: string;
  primary_use_case: string;
  secondary_use_cases: string[];
  user_role: string;           // e.g. "Product Manager"
  industry: string;            // e.g. "Technology"
  category: Category;          // "Writing" | "Analysis" | "Coding" | "Reasoning" | "Automation" | "Ideation" | "Marketing" | "Social Media" | "Ads" | "Image Creator" | "Graphic Design"
  complexity: Complexity;      // "Beginner" | "Intermediate" | "Advanced"
  supported_llms: LLM[];      // "Claude" | "GPT-4" | "GPT-5" | "Gemini" | "Llama"
  output_type: string;         // e.g. "Text", "Code", "Structured Data"
  prompt_text: string;         // The main prompt content
  variations: {
    short: string;             // Concise version
    detailed: string;          // Comprehensive version
    strict: string;            // Rigid/constrained version
  };
  tips: string;                // Usage tips for best results
}
```

### Submission (extends Prompt)

```typescript
interface Submission extends Prompt {
  submitted_at: string;        // ISO timestamp
  status: 'pending' | 'approved' | 'rejected';
}
```

### FilterState

```typescript
interface FilterState {
  query: string;
  categories: Category[];
  complexities: Complexity[];
  llms: LLM[];
}
```

---

## Features & Architecture

### 1. Browse Tab (default)

**Components:** `SearchBar` → `FilterPanel` → `PromptGrid` → `PromptCard` → `PromptDetail`

- **Data loading:** `page.tsx` (server component) reads `public/prompt_library.json` at build/request time and passes it as `initialPrompts` to `ClientPage`.
- **Search:** Client-side full-text search using `buildSearchIndex()` which concatenates all prompt fields into a `_searchText` string. Search terms must all match (AND logic). Debounced at 300ms.
- **Filtering:** Multi-select chip filters for Category, Complexity, and LLM. Combined with search via `searchPrompts()`.
- **Grid:** Responsive 1/2/3 column grid. Lazy-loads in batches of 30. Each card shows category/complexity badges, title, use case, output type, and LLM count.
- **Detail modal:** Clicking a card opens a full modal with variation tabs (Main/Short/Detailed/Strict), metadata, supported LLMs, tips section, and copy button.

### 2. Submit Tab

**Components:** `SubmitForm` → `ArrayInput`

- Multi-section form: Basic Info, Use Cases, Prompt Text, Variations, Additional (LLMs, tips).
- Client-side validation via `validateSubmission()` with field-level error messages.
- Submits to `POST /api/submissions` which validates again server-side, generates a sequential ID (`SUB-001`, `SUB-002`...), and persists to `data/submissions.json`.
- Success state with "Submit Another" reset.

### 3. Prompt Generator Tab

**Components:** `PromptGenerator`

- User describes their task in a textarea.
- On submit, two things happen in parallel:
  1. **Library search:** `findBestPrompts()` scores all prompts using weighted field matching (title=10, use_case=8, category=5, etc.) and returns top 12.
  2. **AI generation:** `POST /api/generate` sends the task + top 3 library matches as context to Gemini.
- **Gemini integration:**
  - Model: `gemini-2.5-flash`
  - System prompt enforces structured output: Role & Context, Task Definition, Detailed Instructions, Constraints, Output Format, Quality Enhancers.
  - Uses `responseMimeType: 'application/json'` with a `responseSchema` for reliable parsing.
  - Temperature: 0.6
  - Output must be plain text (no JSON/code in the prompt content itself).
  - Returns `{ generatedPrompt: string, explanation: string }`.
- Results displayed in two sections:
  - **AI-Generated Prompt:** Glass card with purple glow, copy button, explanation text.
  - **Library Matches:** Grid of scored prompt cards with relevance labels (Excellent/Good/Partial).

### 4. Theme System

- Dark/light mode toggle in Header.
- Persisted to `localStorage`.
- Initialized via inline `<script>` in `layout.tsx` to prevent flash.
- CSS custom properties in `:root` and `.dark` selectors.
- Tailwind's `@custom-variant dark` maps to `.dark` class on `<html>`.

---

## UI Design System

### Theme: Bold & Vibrant

The UI uses a **purple-blue gradient** aesthetic with glass-morphism:

**Color Palette:**
- Light: `#f8f7ff` background, `#7c3aed` → `#3b82f6` gradient accents
- Dark: `#0f0b1e` background, `#a78bfa` → `#60a5fa` gradient accents
- Glass: Semi-transparent white/dark with backdrop blur

**Custom CSS Utilities (defined in `globals.css`):**

| Class | Purpose |
|-------|---------|
| `.glass` | Glass-morphism card (blur 16px, semi-transparent bg, subtle border) |
| `.glass-strong` | Stronger glass effect (blur 24px) for header/tab bar |
| `.btn-gradient` | Purple→blue gradient button with hover reverse animation |
| `.text-gradient` | Gradient text effect with background-clip |
| `.border-gradient` | Animated gradient border using mask technique |
| `.glow-hover` | Lift + purple glow shadow on hover |
| `.glow-purple` | Static purple glow shadow (for AI section) |
| `.tab-active-gradient` | Gradient underline for active tabs |
| `.input-glow` | Focus ring with purple glow |

**Background:** Multi-layered radial gradients on `body` (purple, blue, pink blobs) with `background-attachment: fixed`. Different intensities for light/dark modes.

**Key design decisions:**
- No `bg-background` on `<body>` — the gradient mesh IS the background.
- Custom utilities use `!important` to override Tailwind defaults.
- Components use `glass` for borders instead of Tailwind border classes (to avoid specificity conflicts).
- Inline `style={{ borderTop: '1px solid var(--glass-border)' }}` used where CSS class specificity is insufficient.

---

## API Routes

### `GET /api/prompts`
Returns the full prompt library as JSON array. Cached in memory after first read.

### `POST /api/generate`
**Request:**
```json
{
  "task": "I want to write a blog post about AI trends",
  "libraryContext": ["\"Blog Post Generator\" — Generate blog posts", ...]
}
```
**Response:**
```json
{
  "generatedPrompt": "You are a senior content strategist...",
  "explanation": "This prompt uses role-assignment and chain-of-thought..."
}
```
**Errors:** 400 (missing task), 500 (no API key, Gemini failure)

### `GET /api/submissions`
Returns all submissions from `data/submissions.json`.

### `POST /api/submissions`
Validates and saves a new prompt submission. Returns the created submission with generated ID and `status: 'pending'`.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes (for AI generation) |

Stored in `.env.local` (gitignored).

---

## Search & Scoring Algorithm

### Full-text search (`searchPrompts`)
1. Build index: concatenate all fields into `_searchText` (lowercased).
2. Filter by selected categories, complexities, LLMs.
3. Split query into terms, require ALL terms present in `_searchText`.

### Relevance scoring (`findBestPrompts`)
Weighted field matching:
- `title`: 10 points per matching term
- `primary_use_case`: 8
- `secondary_use_cases`: 6
- `category`: 5
- `user_role`: 4
- `industry`: 4
- `output_type`: 3
- `prompt_text`: 1
- `tips`: 1

Results sorted by total score, filtered to score > 0, limited to top N.

---

## Validation Rules (Submission Form)

| Field | Rule |
|-------|------|
| `title` | 5-100 characters |
| `primary_use_case` | Min 10 characters |
| `prompt_text` | Min 50 characters |
| `user_role` | Required |
| `industry` | Required |
| `output_type` | Required |
| `category` | Must be valid Category |
| `complexity` | Must be valid Complexity |
| `supported_llms` | At least 1 selected |
| `variations.short` | Required |
| `variations.detailed` | Required |
| `variations.strict` | Required |
| `tips` | Required |

---

## Running the Project

```bash
# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Add your GEMINI_API_KEY to .env.local

# Development
npm run dev
# → http://127.0.0.1:4000

# Production build
npm run build
npm start
```

---

## Key Implementation Notes

1. **Server/Client boundary:** `page.tsx` is a server component that reads the JSON file. `ClientPage.tsx` is the `'use client'` boundary — all interactivity lives below it.

2. **No external database:** Prompts are stored in a static JSON file (`public/prompt_library.json`). Submissions are persisted to `data/submissions.json` via the filesystem.

3. **Gemini structured output:** The API route uses `responseMimeType: 'application/json'` with a `responseSchema` to get reliable JSON from Gemini. A fallback parser handles cases where Gemini wraps output in markdown code fences.

4. **CSS specificity strategy:** Custom glass/gradient utilities use `!important` because Tailwind 4's utility classes can override them. Components avoid adding Tailwind border classes when using `.glass` to prevent conflicts.

5. **Dark mode initialization:** An inline script in `<head>` reads `localStorage` before React hydrates to prevent a flash of wrong theme.

6. **Parallel AI + search:** The Prompt Generator fires both the local search and the Gemini API call simultaneously for fast perceived performance.

7. **No authentication:** The app is currently open — no user accounts, no auth on API routes.

8. **Prompt ID format:** Library prompts use category prefixes (`WRT-001`, `ANA-003`, `COD-005`). Submissions use `SUB-001`, `SUB-002`, etc.
