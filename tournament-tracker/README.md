# Tournament Tracker

> A Google Apps Script-powered tournament management system with a mobile-responsive web interface. Tracks brackets, scores, standings, and match results, all backed by Google Sheets with zero infrastructure required.

## AI Stack

| Component | Technology |
|---|---|
| Bracket generation logic | Rule-based + Google Apps Script automation |
| Data backend | Google Sheets (live, collaborative) |
| UI | Server-rendered HTML (Apps Script HtmlService) |

## Key Achievements

- Full tournament lifecycle management: create brackets, record scores, compute standings, advance winners automatically
- Mobile-responsive interface (Mobile.html) so players can check standings and results from their phones
- Google Sheets as the database: real-time collaborative access, no server costs, built-in history
- Single-file deployment via Google Apps Script: `Code.gs` + `Index.html` + `Mobile.html` is all you need

## Tech Stack

- **Backend:** Google Apps Script (V8 runtime)
- **Database:** Google Sheets
- **Frontend:** HtmlService (HTML + CSS + JavaScript, served by Apps Script)
- **Deployment:** Google Apps Script Web App (one-click publish)

## How to Deploy

1. Open [script.google.com](https://script.google.com) and create a new project
2. Copy `Code.gs`, `Index.html`, and `Mobile.html` into the project
3. Create a linked Google Sheet and copy its ID into the script config
4. Click **Deploy** > **New deployment** > **Web app**
5. Set access to "Anyone" (or restrict to your org)
6. Copy the deployment URL and share with participants
