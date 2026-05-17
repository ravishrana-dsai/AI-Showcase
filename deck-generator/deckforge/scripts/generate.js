/**
 * DeckForge CLI
 *
 * Usage:
 *   node scripts/generate.js --brief path/to/brief.md --client "Client Name" --out deck-name
 */

import "dotenv/config";
import { readFile, mkdir, writeFile } from "fs/promises";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Ajv from "ajv";

import { renderDeck, stripJSON } from "./render.js";
import { exportPDF } from "./export.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] ?? true;
      i++;
    }
  }
  return args;
}

function validateArgs(args) {
  const missing = ["brief", "client", "out"].filter((k) => !args[k]);
  if (missing.length) {
    console.error(
      `Missing required arguments: ${missing.map((k) => `--${k}`).join(", ")}`
    );
    console.error(
      "Usage: node scripts/generate.js --brief path/to/brief.md --client \"Client Name\" --out deck-name"
    );
    process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  validateArgs(args);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set. Check your .env file.");
    process.exit(1);
  }

  const briefPath = resolve(args.brief);
  const deckName = args.out;
  const clientName = args.client;

  // 1. Read brief
  console.log(`Reading brief: ${briefPath}`);
  let briefContent;
  try {
    briefContent = await readFile(briefPath, "utf8");
  } catch {
    console.error(`Error: Could not read brief file at "${briefPath}"`);
    process.exit(1);
  }

  // 2. Load outline system prompt
  const outlinePrompt = await readFile(
    join(ROOT, "prompts", "outline.md"),
    "utf8"
  );

  // 3. Call Gemini to generate JSON outline
  console.log("Generating slide outline with Gemini...");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const outlineResult = await model.generateContent([
    { text: outlinePrompt },
    {
      text: `Client: ${clientName}\n\n## Content Brief\n\n${briefContent}`,
    },
  ]);

  const rawOutline = outlineResult.response.text();

  // 4. Strip markdown fences before parsing
  const cleanOutline = stripJSON(rawOutline);
  let outline;
  try {
    outline = JSON.parse(cleanOutline);
  } catch (err) {
    console.error("Error: Gemini returned invalid JSON for the outline.");
    console.error("Raw response:\n", rawOutline);
    process.exit(1);
  }

  // 5. Validate against schema
  console.log("Validating outline against schema...");
  const schema = JSON.parse(
    await readFile(join(ROOT, "schemas", "slide.schema.json"), "utf8")
  );

  const ajv = new Ajv({ strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(outline);

  if (!valid) {
    console.error("Schema validation failed:");
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }

  // Ensure client name in outline matches CLI arg
  outline.deck.client = clientName;

  // 6. Render slides to HTML
  console.log(`Rendering ${outline.deck.slides.length} slides...`);
  const deckHtml = await renderDeck(outline, apiKey);

  // 7. Write deck.html
  const outDir = join(ROOT, "output", deckName);
  await mkdir(outDir, { recursive: true });

  const htmlPath = join(outDir, "deck.html");
  await writeFile(htmlPath, deckHtml, "utf8");
  console.log(`HTML written: ${htmlPath}`);

  // 8. Export to PDF
  console.log("Exporting to PDF...");
  const pdfPath = join(outDir, "deck.pdf");
  await exportPDF(htmlPath, pdfPath);

  // 9. Done
  console.log(`\n Deck ready: output/${deckName}/`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
