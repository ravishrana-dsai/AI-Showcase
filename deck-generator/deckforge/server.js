/**
 * DeckForge — Local Web Dashboard Server
 * Run: node server.js
 * Open: http://localhost:3000
 */

import "dotenv/config";
import express from "express";
import multer from "multer";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { renderDeck, stripJSON } from "./scripts/render.js";
import { exportPDF } from "./scripts/export.js";
import { extractBrand } from "./scripts/brand-extract.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 1090;
const API_KEY = process.env.GEMINI_API_KEY;

const app = express();
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", PPTX_MIME];
    const isPptx = file.originalname?.toLowerCase().endsWith(".pptx");
    cb(null, allowed.includes(file.mimetype) || isPptx);
  },
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(join(__dirname, "public")));
app.use("/output", express.static(join(__dirname, "output")));

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(API_KEY) });
});

// ── Brand extraction from uploaded image ──────────────────────────────────────
app.post("/api/extract-brand", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "File upload failed." });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Accepted formats: PNG, JPG, WEBP, PPTX." });
  }
  if (!API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
  }
  try {
    const colors = await extractBrand(req.file.buffer, req.file.mimetype, req.file.originalname, API_KEY);
    res.json(colors);
  } catch (err) {
    console.error("Brand extract error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Generate deck ─────────────────────────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  const { brief, client, brand, deckName } = req.body;

  if (!brief || !client) {
    return res.status(400).json({ error: "brief and client are required." });
  }
  if (!API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 1. Load outline prompt
    const outlinePrompt = await readFile(
      join(__dirname, "prompts", "outline.md"),
      "utf8"
    );

    // 2. Generate outline
    const outlineResult = await model.generateContent([
      { text: outlinePrompt },
      { text: `Client: ${client}\n\n## Content Brief\n\n${brief}` },
    ]);

    const cleanOutline = stripJSON(outlineResult.response.text());

    let outline;
    try {
      outline = JSON.parse(cleanOutline);
    } catch {
      return res.status(500).json({ error: "Gemini returned invalid JSON for the outline." });
    }

    // 3. Basic sanity check (no strict schema — Gemini output varies)
    if (!outline?.deck?.slides?.length) {
      return res.status(500).json({ error: "Gemini returned an empty or invalid outline." });
    }

    outline.deck.client = client;

    // 4. Render HTML with brand colors
    const deckHtml = await renderDeck(outline, API_KEY, brand || {});

    // 5. Save to output/
    const safeName = (deckName || client)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const outDir = join(__dirname, "output", safeName);
    await mkdir(outDir, { recursive: true });

    const htmlPath = join(outDir, "deck.html");
    const pdfPath  = join(outDir, "deck.pdf");
    await writeFile(htmlPath, deckHtml, "utf8");

    // 6. Export PDF
    await exportPDF(htmlPath, pdfPath);

    res.json({
      deckId:     safeName,
      title:      outline.deck.title,
      slideCount: outline.deck.slides.length,
      htmlUrl:    `/output/${safeName}/deck.html`,
      pdfUrl:     `/output/${safeName}/deck.pdf`,
    });
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ error: err.message || "Generation failed." });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nDeckForge dashboard running at http://localhost:${PORT}\n`);
  if (!API_KEY) {
    console.warn("Warning: GEMINI_API_KEY is not set. Generation will fail.\n");
  }
});
