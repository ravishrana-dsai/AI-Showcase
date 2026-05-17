# Deck Generator — Full Cursor Implementation Prompt

## What This Project Is

A web app that takes user bullet points/key messages and generates professional presentation decks. It uses **Google Gemini API** to understand the narrative behind the content, selects the most appropriate slide templates from an extensive database, generates polished slide content, and exports to both **Google Slides** and **PPTX** formats.

---

## Tech Stack (Already Installed)

- **Framework:** Next.js 16 + TypeScript (App Router) + React 19
- **AI:** `@google/genai` (Google Gemini API)
- **Export:** `pptxgenjs` (PPTX) + `googleapis` (Google Slides API)
- **Auth:** `next-auth` v5 beta (Google OAuth)
- **State:** `zustand` v5
- **UI:** Tailwind CSS v4 + `lucide-react` icons + `framer-motion` animations + `embla-carousel-react`
- **Validation:** `zod` v4 + `zod-to-json-schema`
- **Other:** `uuid`, `file-saver`

All dependencies are already in `package.json` and installed. Don't change versions.

---

## Project Location

`/Users/ravishrana/Desktop/Cursor/Deck Generator/deck-generator/`

---

## What's Already Built (DO NOT REWRITE — extend/import these)

### ✅ Complete Type System (4 files)

**`src/lib/templates/types.ts`** (251 lines) — The foundational type system:
- `VisualStyle` = 'minimal' | 'corporate' | 'creative' | 'bold'
- `TemplateCategory` = 23 categories (title, agenda, process-flow, timeline, comparison, chart, team, swot, closing, quote, metrics-kpi, icon-layout, image-layout, bullet-layout, hierarchy, venn, matrix, funnel, roadmap, feature-highlight, pricing, testimonial, section-divider)
- `ElementType` = 'text' | 'shape' | 'image-placeholder' | 'icon-placeholder' | 'chart-placeholder' | 'line' | 'group'
- `ContentRole` = 'title' | 'subtitle' | 'body' | 'heading' | 'label' | 'number' | 'caption' | 'speaker-notes' | 'decorative'
- `Position` { x, y, w, h (inches), rotate? }
- `FontSpec` { family, size, color, bold?, italic?, underline?, lineSpacing?, align?, valign? }
- `FillSpec` { type: 'solid'|'gradient', color, gradientTo?, gradientAngle?, transparency? }
- `BorderSpec`, `ShadowSpec`
- `TemplateElement` { id, type, role, position, font?, fill?, border?, shadow?, shapeType?, placeholder?: { label, minChars?, maxChars?, required? }, chartType?, children? }
- `ColorTheme` { id, name, primary, secondary, accent, background, surface, textPrimary, textSecondary, textOnPrimary }
- `SlideTemplate` { id, name, description, category, subcategory?, visualStyle, tags[], contentCapacity: { minElements, maxElements, idealElements }, elements[], defaultColorTheme, backgroundFill?, thumbnail?, useCaseTags[], compatiblePurposes[] }

**`src/types/deck.ts`** (72 lines):
- `ChartDataPayload` { labels: string[], datasets: { name, values: number[] }[] }
- `GeneratedSlide` { slideIndex, templateId, content: Record<string,string>, speakerNotes, chartData? }
- `Deck` { id, title, slides: GeneratedSlide[], colorTheme, metadata: { purpose, narrativeArc, slideCount, generatedAt } }

**`src/types/generation.ts`** (92 lines):
- `PresentationPurpose` = 'pitch' | 'report' | 'educational' | 'proposal' | 'general'
- `GenerateRequest` { bulletPoints, purpose, style, colorScheme?, slideCount?, additionalInstructions? }
- `GenerateResponse` = Deck
- `SlidePlanItem` { slideIndex, category, subcategory?, purpose, sourcePointIndices[], contentDensity: 'low'|'medium'|'high', needsVisual, visualType?, suggestedChartType?, transitionNote }
- `ContentAnalysis` { narrativeArc, confirmedPurpose, overallTone, suggestedTitle, slidePlan[], colorSuggestion? }

**`src/types/export.ts`** (58 lines):
- `RenderableSlide` { template, content, colorTheme, chartData?, speakerNotes }
- `RenderableDeck` { title, slides[], globalColorTheme, slideSize: { width, height } }
- `ExportFormat` = 'pptx' | 'google-slides'

### ✅ Template Registry (`src/lib/templates/registry.ts`, 145 lines)
- `TemplateRegistry` class with Map indexing by id, category, tags
- Methods: `getById()`, `getByCategory()`, `searchByTags()`, `getAll()`, `getFiltered(criteria)`
- Singleton pattern via `getRegistry()` which lazy-loads from `@/data/templates`
- **IMPORTANT:** `getRegistry()` calls `require('@/data/templates')` expecting an `{ allTemplates }` export — the index file that provides this is MISSING and must be created

### ✅ Template Matcher (`src/lib/templates/matcher.ts`, 236 lines)
- Multi-factor scoring algorithm: categoryMatch(40pts), subcategoryMatch(15pts), capacityFit(15pts), styleFit(10pts), purposeFit(10pts), tagOverlap(10pts), diversityBonus(±5pts)
- `matchTemplates(slidePlan, userStyle, userPurpose)` → `TemplateMatch[]`
- Uses Jaccard similarity for tag overlap, keyword extraction with stopword removal
- **NOTE:** `contentDensity` in `SlidePlanItem` is typed as `'low'|'medium'|'high'` but the matcher compares it numerically against `template.contentCapacity` — this needs to be fixed. Either change the type to `number` or add a mapping (low=2, medium=4, high=6)

### ✅ Utility Functions (`src/lib/utils.ts`, 119 lines)
- `cn(...classes)` — className merger
- `hexToRgb(hex)` → `{red,green,blue}` (0-1 floats for Google Slides API)
- `resolveThemeColor(colorValue, theme)` — resolves `{{primary}}` tokens to hex
- `generateId()` — UUID v4
- `truncateText(text, maxChars)`
- `inchesToPoints(inches)`, `pointsToInches(points)`

### ✅ SlideRenderer Component (`src/components/preview/SlideRenderer.tsx`, 506 lines)
- Client component that renders a template + content + theme as scaled HTML/CSS
- Handles all element types: text, shape, line, image-placeholder, icon-placeholder, chart-placeholder, group
- Canvas: 13.333 × 7.5 inches at 96 PPI
- Supports interactive mode (click-to-edit), theme token resolution
- Props: `{ template, content, colorTheme, chartData?, scale?, interactive?, onElementClick?, className? }`

### ✅ Input Components (3 files)
- **`src/components/input/BulletPointInput.tsx`** — Textarea with example loader, line counter. Imports `useDeckStore` from `@/stores/deck-store`
- **`src/components/input/PurposeSelector.tsx`** — 5 purpose buttons with icons. Imports `useDeckStore`
- **`src/components/input/StylePreferences.tsx`** — 4 style cards with color preview dots. Imports `useDeckStore`

### ✅ Header (`src/components/layout/Header.tsx`)
- Sticky header with DeckGen logo, links to `/generator` and `/templates`

### ✅ Config Files
- `tsconfig.json` — strict mode, path alias `@/*` → `./src/*`
- `postcss.config.mjs` — Tailwind v4 with @tailwindcss/postcss
- `eslint.config.mjs` — ESLint v9 flat config

### ✅ Env Placeholders
- `.env.local` and `.env.example` exist with empty values for: `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

---

## What's EMPTY / BROKEN (Must Be Built)

### 🔴 CRITICAL: Zustand Store (`src/stores/deck-store.ts`) — 0 bytes
**3 components import `useDeckStore` from this file and will crash without it.**

Must export `useDeckStore` created with `create` from `zustand`. State shape:

```typescript
interface DeckState {
  // Input
  bulletPoints: string;
  purpose: PresentationPurpose; // default: 'general'
  style: VisualStyle; // default: 'minimal'
  slideCount: number | null;
  additionalInstructions: string;

  // Generation
  isGenerating: boolean;
  generationProgress: string;
  error: string | null;

  // Deck
  deck: Deck | null;
  selectedSlideIndex: number;

  // Export
  isExporting: boolean;
  exportFormat: 'pptx' | 'google-slides' | null;

  // Actions
  setBulletPoints: (text: string) => void;
  setPurpose: (purpose: PresentationPurpose) => void;
  setStyle: (style: VisualStyle) => void;
  setSlideCount: (count: number | null) => void;
  setAdditionalInstructions: (text: string) => void;
  setGenerating: (isGenerating: boolean) => void;
  setGenerationProgress: (progress: string) => void;
  setError: (error: string | null) => void;
  setDeck: (deck: Deck) => void;
  setSelectedSlideIndex: (index: number) => void;
  updateSlideContent: (slideIndex: number, elementId: string, content: string) => void;
  updateSpeakerNotes: (slideIndex: number, notes: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  deleteSlide: (index: number) => void;
  updateColorTheme: (theme: ColorTheme) => void;
  setExporting: (isExporting: boolean, format?: 'pptx' | 'google-slides' | null) => void;
  reset: () => void;
}
```

### 🔴 CRITICAL: ALL Template Data Files — 0 bytes each
These 10 files exist but are completely empty:
- `src/data/templates/features.ts`
- `src/data/templates/funnel.ts`
- `src/data/templates/hierarchy.ts`
- `src/data/templates/icon-layouts.ts`
- `src/data/templates/image-layouts.ts`
- `src/data/templates/matrix.ts`
- `src/data/templates/pricing.ts`
- `src/data/templates/roadmap.ts`
- `src/data/templates/testimonials.ts`
- `src/data/templates/venn.ts`

**Plus these files DON'T EXIST yet and need to be created:**
- `src/data/templates/title-slides.ts`
- `src/data/templates/agenda.ts`
- `src/data/templates/process-flows.ts`
- `src/data/templates/timelines.ts`
- `src/data/templates/comparison.ts`
- `src/data/templates/bullet-layouts.ts`
- `src/data/templates/charts.ts`
- `src/data/templates/team-about.ts`
- `src/data/templates/swot.ts`
- `src/data/templates/closing.ts`
- `src/data/templates/quotes.ts`
- `src/data/templates/metrics-kpi.ts`
- `src/data/templates/section-dividers.ts`
- **`src/data/templates/index.ts`** — MUST export `{ allTemplates: SlideTemplate[] }` aggregating all template files. The registry lazy-loads from this.

**Template Format:** Each file must import `SlideTemplate` from `@/lib/templates/types` and export template objects. Canvas is 13.333 × 7.5 inches. Positions in inches. Each template needs: id, name, description, category, subcategory?, visualStyle, tags[], contentCapacity, elements[] (with TemplateElement objects), defaultColorTheme (all 10 fields), backgroundFill?, useCaseTags[], compatiblePurposes[].

**Target: 3-5 variants per category = 60-120 total templates. Categories:**
- title (4 variants: centered, left-aligned, bold, gradient)
- agenda (3: numbered, grid, timeline-style)
- process-flow (5: 3-step horizontal, 4-step, 5-step, circular, vertical)
- timeline (3: horizontal, vertical, roadmap)
- comparison (3: 2-col, 3-col, pros-cons)
- chart (3: bar, pie, line)
- team (3: grid-4, grid-6, about-company)
- swot (2: grid, linear)
- closing (3: thank-you, CTA, contact)
- quote (2: centered, with-image)
- metrics-kpi (3: 3-col, 4-col, dashboard)
- icon-layout (2: 3-col, 4-col)
- image-layout (2: full-left, split)
- bullet-layout (4: simple, with-icon, two-column, numbered)
- hierarchy (2: pyramid, org-chart)
- venn (2: 2-circle, 3-circle)
- matrix (2: 2x2, 3x3)
- funnel (2: 4-stage vertical, horizontal)
- roadmap (2: quarterly, phased)
- feature-highlight (3: 3-col, highlight, grid)
- pricing (2: 3-tier, comparison)
- testimonial (2: single, multi)
- section-divider (2: centered, bold)

### 🔴 CRITICAL: Gemini Client (`src/lib/gemini/client.ts`) — 0 bytes

Must create the full Gemini AI pipeline (5-6 files):

**`src/lib/gemini/client.ts`:**
```typescript
import { GoogleGenAI } from '@google/genai';
export const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
export const ANALYSIS_MODEL = 'gemini-2.0-flash';
export const CONTENT_MODEL = 'gemini-2.0-flash';
```

**`src/lib/gemini/prompts.ts`** — Prompt templates:
- `getAnalysisSystemPrompt()` — Expert presentation designer that analyzes bullet points, understands narrative arc, purpose, themes, visual needs. Must list all 23 template categories and subcategories. Rules: always start with title, end with closing, use section dividers between major topics, prefer visual templates, 8-15 slides typical.
- `getAnalysisUserPrompt(bulletPoints, purpose, style, slideCount?)` — Includes user's content and preferences.
- `getContentSystemPrompt()` — Expert copywriter. Rules: titles 3-8 words no periods, subtitles one sentence, body concise, respect maxChars, no placeholder brackets.
- `getContentUserPrompt(slideContext)` — Per-slide prompt with slide context, source bullet points, template elements needing content (their IDs, roles, maxChars).

**`src/lib/gemini/schemas.ts`** — Zod schemas for structured Gemini output:
- `ContentAnalysisSchema` — matches `ContentAnalysis` type
- `SlideContentSchema` — `{ content: Record<string,string>, speakerNotes: string, chartData?: {...} }`
- `zodToGeminiSchema(schema)` — converts Zod schema to JSON Schema for Gemini's `responseSchema`

**`src/lib/gemini/analyze.ts`:**
- `analyzeContent(bulletPoints, purpose, style, slideCount?)` → `Promise<ContentAnalysis>`
- Calls Gemini with `responseMimeType: 'application/json'` and the JSON schema

**`src/lib/gemini/generate-slides.ts`:**
- `generateSlideContent(slidePlan, matchedTemplates: Map<number, SlideTemplate>, bulletPoints, purpose)` → `Promise<GeneratedSlide[]>`
- Process slides in batches of 3 for efficiency
- For each slide, include template element constraints (IDs, roles, maxChars)

### 🔴 Button Component (`src/components/ui/Button.tsx`) — 0 bytes
Need this plus all other UI primitives:
- `Button.tsx` — variants: primary/secondary/ghost/danger, sizes: sm/md/lg, isLoading state
- `Input.tsx` — with label, error message
- `Textarea.tsx` — with label, error
- `Select.tsx` — native select with label, error, options
- `Card.tsx` — white bg, rounded-xl, shadow, optional hover
- `Modal.tsx` — overlay, centered modal, close button, size variants
- `Tabs.tsx` — horizontal tab bar with underline indicator
- `Badge.tsx` — pill badge with color variants
- `Spinner.tsx` — animated SVG spinner, size variants
- `DropdownMenu.tsx` — click dropdown with items

All should use `'use client'`, Tailwind, `cn()` from `@/lib/utils`, be properly typed with `React.forwardRef` where appropriate.

---

## What Needs to Be Created From Scratch

### Pages / Routes

**`src/app/page.tsx`** — Currently default Next.js boilerplate. Replace with landing page:
- Hero section with app name, tagline, CTA button to /generator
- Feature highlights (AI-powered, multiple templates, dual export)
- Use Header component

**`src/app/layout.tsx`** — Currently basic. Update to include Header component.

**`src/app/generator/page.tsx`** — Main generation page:
- Left panel: BulletPointInput, PurposeSelector, StylePreferences, GenerateButton
- Right panel: DeckPreview (appears after generation) with SlideCarousel + large SlideRenderer + SpeakerNotesPanel
- ExportDialog triggered from toolbar

**`src/app/templates/page.tsx`** — Template gallery:
- TemplateFilter (by category, style, purpose, search)
- TemplateGallery (grid of TemplateCards)
- Each card shows SlideRenderer with placeholder content

### Preview Components (in `src/components/preview/`)

**`DeckPreview.tsx`** — Container showing the full deck:
- Slide thumbnail strip (carousel) at top
- Large selected slide preview
- SlideToolbar (reorder, delete, regenerate buttons)
- SpeakerNotesPanel

**`SlideCarousel.tsx`** — Horizontal scrollable thumbnail strip using `embla-carousel-react`:
- Small SlideRenderer for each slide
- Click to select, highlight active

**`SpeakerNotesPanel.tsx`** — Collapsible panel showing speaker notes for the selected slide

### Export Components (in `src/components/export/`)

**`ExportDialog.tsx`** — Modal with two export options (PPTX + Google Slides)

**`PptxExport.tsx`** — Button that:
1. Converts deck to `RenderableDeck` (resolving template IDs to full templates)
2. Calls `renderToPptx()` from `src/lib/export/pptx-renderer.ts`
3. Downloads using `file-saver`

**`GoogleSlidesExport.tsx`** — Button that:
1. Checks auth (requires Google sign-in)
2. Calls `/api/export/google-slides` route
3. Opens resulting presentation URL

### Export Renderers (in `src/lib/export/`)

**`src/lib/export/shared-renderer.ts`** — Shared utilities:
- `resolveThemeColor()` (can reuse from utils.ts)
- `mapShapeType(abstractType)` → pptxgenjs shape name
- `mapToGoogleShapeType(abstractType)` → Google Slides API shape type
- `hexToRgb()` (reuse from utils.ts)

**`src/lib/export/pptx-renderer.ts`** — PPTX rendering engine:
- `renderToPptx(deck: RenderableDeck): Promise<Blob>`
- Uses `pptxgenjs` — `LAYOUT_WIDE` (13.333 × 7.5 inches)
- Handles: text (addText), shapes (addShape), lines, chart-placeholder (addChart), image-placeholder (gray rect), speaker notes (addNotes)
- Resolves theme tokens, applies fonts, fills, borders
- Returns Blob for download

**`src/lib/export/google-slides-renderer.ts`** — Google Slides API renderer:
- `renderToGoogleSlides(deck: RenderableDeck, accessToken: string): Promise<{presentationId, url}>`
- Uses `googleapis` — `slides.presentations.create`, `batchUpdate`
- Converts inches to points (× 72)
- Creates blank slides, adds shapes/text via batch requests
- Handles: createSlide, createShape, insertText, updateTextStyle, updateShapeProperties, createLine
- Speaker notes in second batch (need notesPage object IDs)

### API Routes

**`src/app/api/generate/route.ts`** — POST endpoint:
1. Parse/validate request body with Zod
2. Call `analyzeContent()` → get slide plan
3. Call `matchTemplates()` → get template matches
4. Call `generateSlideContent()` → get slide content
5. Assemble and return `Deck` object

**`src/app/api/export/google-slides/route.ts`** — POST endpoint:
1. Get user's Google OAuth access token from session
2. Convert deck to RenderableDeck
3. Call `renderToGoogleSlides()`
4. Return `{ presentationId, presentationUrl }`

**`src/app/api/export/pptx/route.ts`** — POST endpoint (server-side fallback):
1. Convert deck to RenderableDeck
2. Call pptx renderer server-side
3. Stream PPTX binary as download

**`src/app/api/templates/route.ts`** — GET endpoint:
- Query params: category, style, purpose, search
- Returns filtered template summaries from registry

### Auth Setup

**`src/lib/auth.ts`** — NextAuth v5 config:
- Google provider with scopes: `https://www.googleapis.com/auth/presentations`, `https://www.googleapis.com/auth/drive.file`
- JWT callback to store access token
- Session callback to expose access token

**`src/app/api/auth/[...nextauth]/route.ts`** — NextAuth route handler

**`src/components/auth/AuthButton.tsx`** — Sign in/out button

### Hooks (in `src/hooks/`)

**`useGenerateDeck.ts`** — Wraps `/api/generate` call, reads/writes deck store
**`useExport.ts`** — Wraps PPTX download + Google Slides export
**`useTemplates.ts`** — Filters templates using registry

### Editor Components (in `src/components/editor/`)

**`SlideEditor.tsx`** — Full editor for a single slide (live preview + element editing)
**`TextEditor.tsx`** — Click text element to edit inline
**`LayoutSwitcher.tsx`** — Switch a slide's template
**`ColorPicker.tsx`** — Change theme colors

### Template Gallery (in `src/components/templates/`)

**`TemplateGallery.tsx`** — Grid view of all templates
**`TemplateCard.tsx`** — Individual template preview card
**`TemplateFilter.tsx`** — Filter UI
**`TemplatePreview.tsx`** — Full-size preview modal

---

## Known Type Issue to Fix

In `src/types/generation.ts`, `SlidePlanItem.contentDensity` is typed as `'low' | 'medium' | 'high'`. But in `src/lib/templates/matcher.ts`, the code does numerical comparison against `template.contentCapacity.idealElements` (a number). **Fix:** Either change `contentDensity` to `number` in the type definition, or add a mapping function in the matcher:
```typescript
function densityToNumber(density: 'low' | 'medium' | 'high'): number {
  return density === 'low' ? 2 : density === 'medium' ? 4 : 6;
}
```

---

## Architecture Notes

### Template Token System
Templates use `{{primary}}`, `{{secondary}}`, `{{accent}}`, etc. as color values. These get resolved at render time against the active `ColorTheme`. This allows the same template to work with any color scheme.

### Canvas System
All templates use 13.333 × 7.5 inch coordinate system (16:9 widescreen):
- **pptxgenjs:** uses inches natively (`LAYOUT_WIDE`)
- **Google Slides API:** uses points (multiply inches × 72)
- **Browser preview (SlideRenderer):** uses percentages of container width with aspect-ratio padding trick

### AI Pipeline Flow
```
User Input → analyzeContent() → ContentAnalysis (slide plan)
                                       ↓
                              matchTemplates() → TemplateMatch[] (best template per slide)
                                       ↓
                          generateSlideContent() → GeneratedSlide[] (actual text content)
                                       ↓
                                  Assemble Deck → Return to client
```

### Dual Export Strategy
Both renderers consume the same `RenderableDeck` intermediate representation:
1. Convert `Deck` (with template IDs) → `RenderableDeck` (with full template objects resolved via registry)
2. Pass to either `renderToPptx()` (client-side, returns Blob) or `renderToGoogleSlides()` (server-side, returns URL)

---

## Implementation Order (Recommended)

1. **Zustand store** — Unblocks 3 existing components
2. **Template data files + index.ts** — Unblocks registry and matcher
3. **Gemini pipeline** (client, prompts, schemas, analyze, generate-slides)
4. **UI primitive components** (Button, Modal, Spinner, etc.)
5. **`/api/generate` route** — Wire up the AI pipeline
6. **Generator page** — Main app page with input + preview
7. **Preview components** (DeckPreview, SlideCarousel, SpeakerNotesPanel)
8. **PPTX renderer + PptxExport component**
9. **Auth setup + Google Slides renderer + export component**
10. **Landing page, template gallery page**
11. **Editor components** (TextEditor, LayoutSwitcher, ColorPicker)
12. **Polish** — loading states, error handling, responsive design

---

## Environment Variables Needed

```env
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
NEXTAUTH_URL=http://localhost:3000
```

---

## Dev Server

```bash
cd "/Users/ravishrana/Desktop/Cursor/Deck Generator/deck-generator"
npm run dev
# Runs on http://localhost:3000
```

---

## File Checklist

### Must Create (Empty/Missing):
- [ ] `src/stores/deck-store.ts` (0 bytes → full Zustand store)
- [ ] `src/data/templates/title-slides.ts` (doesn't exist)
- [ ] `src/data/templates/agenda.ts` (doesn't exist)
- [ ] `src/data/templates/process-flows.ts` (doesn't exist)
- [ ] `src/data/templates/timelines.ts` (doesn't exist)
- [ ] `src/data/templates/comparison.ts` (doesn't exist)
- [ ] `src/data/templates/bullet-layouts.ts` (doesn't exist)
- [ ] `src/data/templates/charts.ts` (doesn't exist)
- [ ] `src/data/templates/team-about.ts` (doesn't exist)
- [ ] `src/data/templates/swot.ts` (doesn't exist)
- [ ] `src/data/templates/closing.ts` (doesn't exist)
- [ ] `src/data/templates/quotes.ts` (doesn't exist)
- [ ] `src/data/templates/metrics-kpi.ts` (doesn't exist)
- [ ] `src/data/templates/section-dividers.ts` (doesn't exist)
- [ ] `src/data/templates/features.ts` (0 bytes)
- [ ] `src/data/templates/funnel.ts` (0 bytes)
- [ ] `src/data/templates/hierarchy.ts` (0 bytes)
- [ ] `src/data/templates/icon-layouts.ts` (0 bytes)
- [ ] `src/data/templates/image-layouts.ts` (0 bytes)
- [ ] `src/data/templates/matrix.ts` (0 bytes)
- [ ] `src/data/templates/pricing.ts` (0 bytes)
- [ ] `src/data/templates/roadmap.ts` (0 bytes)
- [ ] `src/data/templates/testimonials.ts` (0 bytes)
- [ ] `src/data/templates/venn.ts` (0 bytes)
- [ ] `src/data/templates/index.ts` (barrel export with `allTemplates`)
- [ ] `src/lib/gemini/client.ts` (0 bytes)
- [ ] `src/lib/gemini/prompts.ts`
- [ ] `src/lib/gemini/schemas.ts`
- [ ] `src/lib/gemini/analyze.ts`
- [ ] `src/lib/gemini/generate-slides.ts`
- [ ] `src/lib/gemini/types.ts`
- [ ] `src/components/ui/Button.tsx` (0 bytes)
- [ ] `src/components/ui/Input.tsx`
- [ ] `src/components/ui/Textarea.tsx`
- [ ] `src/components/ui/Select.tsx`
- [ ] `src/components/ui/Card.tsx`
- [ ] `src/components/ui/Modal.tsx`
- [ ] `src/components/ui/Tabs.tsx`
- [ ] `src/components/ui/Badge.tsx`
- [ ] `src/components/ui/Spinner.tsx`
- [ ] `src/components/ui/DropdownMenu.tsx`
- [ ] `src/components/preview/DeckPreview.tsx`
- [ ] `src/components/preview/SlideCarousel.tsx`
- [ ] `src/components/preview/SpeakerNotesPanel.tsx`
- [ ] `src/components/export/ExportDialog.tsx`
- [ ] `src/components/export/PptxExport.tsx`
- [ ] `src/components/export/GoogleSlidesExport.tsx`
- [ ] `src/components/editor/SlideEditor.tsx`
- [ ] `src/components/editor/TextEditor.tsx`
- [ ] `src/components/editor/LayoutSwitcher.tsx`
- [ ] `src/components/editor/ColorPicker.tsx`
- [ ] `src/components/templates/TemplateGallery.tsx`
- [ ] `src/components/templates/TemplateCard.tsx`
- [ ] `src/components/templates/TemplateFilter.tsx`
- [ ] `src/components/templates/TemplatePreview.tsx`
- [ ] `src/components/auth/AuthButton.tsx`
- [ ] `src/hooks/useGenerateDeck.ts`
- [ ] `src/hooks/useExport.ts`
- [ ] `src/hooks/useTemplates.ts`
- [ ] `src/lib/auth.ts`
- [ ] `src/lib/export/pptx-renderer.ts`
- [ ] `src/lib/export/google-slides-renderer.ts`
- [ ] `src/lib/export/shared-renderer.ts`
- [ ] `src/app/generator/page.tsx`
- [ ] `src/app/templates/page.tsx`
- [ ] `src/app/api/generate/route.ts`
- [ ] `src/app/api/export/google-slides/route.ts`
- [ ] `src/app/api/export/pptx/route.ts`
- [ ] `src/app/api/templates/route.ts`
- [ ] `src/app/api/auth/[...nextauth]/route.ts`

### Must Update (Existing but needs changes):
- [ ] `src/app/page.tsx` (replace boilerplate with landing page)
- [ ] `src/app/layout.tsx` (add Header component)
- [ ] `src/types/generation.ts` (fix `contentDensity` type mismatch — see Known Issues above)

### Already Complete (Don't Touch):
- ✅ `src/lib/templates/types.ts`
- ✅ `src/types/deck.ts`
- ✅ `src/types/export.ts`
- ✅ `src/lib/templates/registry.ts`
- ✅ `src/lib/templates/matcher.ts`
- ✅ `src/lib/utils.ts`
- ✅ `src/components/preview/SlideRenderer.tsx`
- ✅ `src/components/input/BulletPointInput.tsx`
- ✅ `src/components/input/PurposeSelector.tsx`
- ✅ `src/components/input/StylePreferences.tsx`
- ✅ `src/components/layout/Header.tsx`
