# Prompt Library

> A centralized prompt management system for LLM workflows. Stores, versions, and organizes AI prompts across multiple projects in a structured JSON format, with a web UI for browsing and editing.

## AI Stack

| Component | Technology |
|---|---|
| Prompt storage | JSON-based versioned library (`prompt_library.json`) |
| UI | Web frontend (HTML + JavaScript) |

## Key Achievements

- Single source of truth for all LLM prompts across multiple projects, preventing prompt drift and duplication
- Structured JSON schema allows prompts to carry metadata: name, category, version, model target, and usage notes
- Web UI for browsing, searching, and editing prompts without touching JSON directly
- Two parallel implementations included: `prompt-library/` (v1) and `Prompt Library new/` (v2 with extended features)

## Structure

```
prompt-library/
  prompt_library.json       # Master prompt store (all prompts, versioned)
  prompt-library/           # v1 web UI
  Prompt Library new/       # v2 web UI (extended features)
```

## How to Use

### Browse prompts

Open `prompt-library/index.html` in a browser to view and search the library.

### Add a prompt

Edit `prompt_library.json` and add an entry:

```json
{
  "id": "unique-id",
  "name": "Prompt Name",
  "category": "analysis",
  "version": "1.0",
  "model": "claude-sonnet-4-6",
  "prompt": "Your prompt text here...",
  "notes": "Optional usage notes"
}
```
