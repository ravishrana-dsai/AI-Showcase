# Deck Generator

> Enter bullet points or key messages and get a polished, export-ready presentation deck. Two AI-powered implementations: a full Next.js app with Google Slides + PPTX export, and a lightweight Express server with Puppeteer rendering.

## AI Stack

| Component | Technology |
|---|---|
| Narrative understanding + slide selection | Google Gemini API |
| Template matching | LLM-driven template selector (23 template categories) |
| Slide content generation | Google Gemini API |
| Export | `pptxgenjs` (PPTX), Google Slides API, Puppeteer (PDF) |

## Key Achievements

- Gemini understands the narrative arc behind bullet points and selects from 23 slide template categories (title, agenda, process-flow, timeline, comparison, SWOT, metrics-KPI, roadmap, pricing, and more)
- Dual export: generates both PPTX files and Google Slides presentations from the same input
- Rich type system: 251-line template type definition covering element positioning, font specs, fill specs, color themes, and content capacity constraints
- Google OAuth integration for direct Slides API publishing
- Two independent implementations included: `deck-generator` (full Next.js + Google Slides) and `deckforge` (Express + Puppeteer, no OAuth required)

## Implementations

### `deck-generator/` (Full stack)
Next.js 16, TypeScript, Tailwind CSS v4, React 19, Zustand state management, Framer Motion animations, Google OAuth, PPTX + Google Slides export.

### `deckforge/` (Lightweight)
Express.js server, Gemini API, Puppeteer for rendering, JSZip for export. No OAuth required.

## Tech Stack

- **Framework:** Next.js 16 (deck-generator), Express.js (deckforge)
- **AI:** `@google/genai` (Gemini)
- **Export:** `pptxgenjs`, Google Slides API (`googleapis`), Puppeteer
- **Auth:** NextAuth v5 + Google OAuth (deck-generator)
- **State:** Zustand v5

## How to Run

### deck-generator

```bash
cd deck-generator
npm install
cp .env.example .env.local
# Add GEMINI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm run dev
```

### deckforge

```bash
cd deckforge
npm install
cp .env.example .env
# Add GEMINI_API_KEY
npm start
```
