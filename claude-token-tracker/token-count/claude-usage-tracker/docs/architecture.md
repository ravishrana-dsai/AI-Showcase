# Claude Usage Tracker — Architecture

## Phase 1 (current)

```mermaid
flowchart TD
    subgraph Sources["Data Sources"]
        CC["Claude Code CLI\n(terminal)"]
        CAI["Claude.ai\n(browser)"]
    end

    subgraph ExtFlow["Browser Extension  (Chrome MV3)"]
        NH["network_hook.js\nMAIN world\nwraps window.fetch\nparses SSE stream"]
        RL["relay.js\nISOLATED world\nwindow.postMessage relay"]
        SW["service_worker.js\nbackground\nPOST → localhost:9877"]
        NH -->|window.postMessage| RL --> SW
    end

    subgraph ElectronApp["Electron Menubar App"]
        CR["claude_reader.js\nparses ~/.claude/projects/**/*.jsonl\ndeduplicates entries"]
        IS["ingest_server.js\nHTTP :9877\nreceives extension data"]
        PR["pricing.js\ncache-aware cost calc\ninput / cacheWrite / cacheRead / output"]
        MN["main.js\ntray icon + menu\nfs.watch on ~/.claude/\nIPC bridge"]
        DB["dashboard.html\nOverview  Calls  Sessions tabs\nChart.js charts"]

        CR --> MN
        IS --> MN
        MN --> PR
        MN --> DB
    end

    CC -->|writes per-message JSONL\n~/.claude/projects/.../*.jsonl| CR
    CAI -->|fetch intercepted| NH
    SW -->|POST /ingest| IS
```

## Phase 2 (planned)

```mermaid
flowchart TD
    subgraph NewSources["Additional Sources"]
        CD["Claude Desktop\n(macOS app)"]
        CW["Cowork\n(macOS app)"]
    end

    subgraph Proxy["Lightweight Local Proxy  :9876"]
        PX["Node.js HTTP proxy\nforwards to api.anthropic.com\nreads response body for tokens\nno SSL cert / no mitmproxy"]
    end

    subgraph ElectronApp["Electron App (extended)"]
        IS["ingest_server.js :9877"]
    end

    CD -->|networksetup system proxy\nor ANTHROPIC_BASE_URL| PX
    CW -->|same| PX
    PX -->|POST /ingest| IS
```

## Token cost model

| Token type | How it arises | Pricing (Sonnet 4.6) |
|---|---|---|
| `input_tokens` | Fresh text not in cache | $3.00 / MTok |
| `cache_creation_input_tokens` | Building a new cache entry | $3.75 / MTok |
| `cache_read_input_tokens` | Reading from existing cache | $0.30 / MTok |
| `output_tokens` | Model response | $15.00 / MTok |

Cache reads are 10x cheaper than input. Claude Code uses prompt caching heavily — most tokens in a long session are cheap cache reads.

## Key files

```
claude-usage-tracker/
├── src/
│   ├── main.js            Electron entry: tray, IPC, fs.watch, lifecycle
│   ├── claude_reader.js   Reads ~/.claude/ JSONL, aggregates by day/session
│   ├── pricing.js         Cache-aware cost calculation per model
│   ├── ingest_server.js   HTTP :9877 — receives data from browser extension
│   ├── icon.js            Programmatic PNG tray icon (no external assets)
│   └── dashboard.html     Single-file UI: Overview, Calls, Sessions tabs
├── extension/
│   ├── manifest.json      Chrome MV3, MAIN world content script
│   ├── content/
│   │   ├── network_hook.js  Wraps window.fetch, parses SSE (MAIN world)
│   │   └── relay.js         Forwards postMessage → background (ISOLATED world)
│   ├── background/
│   │   └── service_worker.js  POSTs to :9877, persists daily totals
│   └── popup/
│       └── popup.html       Extension popup showing Claude.ai today stats
├── scripts/
│   ├── setup.sh           Phase 2: mitmproxy + system proxy setup
│   ├── teardown.sh        Phase 2: remove system proxy
│   └── mitm_hook.py       Phase 2: mitmproxy addon for Desktop/Cowork
└── docs/
    └── architecture.md    This file
```
