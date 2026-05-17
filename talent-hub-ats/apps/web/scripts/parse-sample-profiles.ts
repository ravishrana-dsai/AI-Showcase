/**
 * Run the real parseResume pipeline on PDF/DOCX/DOC files in a folder.
 *
 * Usage (from apps/web):
 *   npm run parse-samples -- /path/to/your/profiles
 *   npm run parse-samples -- ./samples
 *
 * Optional env:
 *   RESUME_PDF_OCR=0     — disable all PDF OCR (text extraction only)
 *
 * Flags (after --):
 *   --skip-optional-ocr  — same as unchecking "Extra OCR on noisy text" (thin PDFs still OCR)
 */

import fs from "node:fs";
import path from "node:path";
import { parseResume } from "../src/lib/resume-parser";

const EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
};

async function main() {
  const argv = process.argv.slice(2);
  const skipOptionalOcr = argv.includes("--skip-optional-ocr");
  const dir = argv.find((a) => !a.startsWith("--"));

  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(
      "Usage: npm run parse-samples -- <folder-with-pdf-docx-doc>\n"
    );
    console.error(
      "       Optional: --skip-optional-ocr\n"
    );
    console.error(
      "Example: npm run parse-samples -- ~/Downloads/linkedin-exports\n"
    );
    process.exit(1);
  }

  const abs = path.resolve(dir);
  const files = fs
    .readdirSync(abs)
    .filter((f) => /\.(pdf|docx|doc)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log("No .pdf / .docx / .doc files in:", abs);
    process.exit(0);
  }

  const opts = skipOptionalOcr ? { skipPdfOcr: true as const } : undefined;

  console.log(`Folder: ${abs}`);
  console.log(`Files: ${files.length}`);
  if (skipOptionalOcr) console.log("Flag: skip optional OCR (long junk only)\n");
  if (process.env.RESUME_PDF_OCR === "0" || process.env.RESUME_PDF_OCR === "false") {
    console.log("Env: RESUME_PDF_OCR disabled (no OCR)\n");
  }
  console.log();

  for (const name of files) {
    const full = path.join(abs, name);
    const ext = path.extname(name).toLowerCase();
    const mime = EXT_MIME[ext];
    const buffer = fs.readFileSync(full);

    console.log("─".repeat(64));
    console.log(name, `(${buffer.length} bytes)`);

    const t0 = Date.now();
    try {
      const p = await parseResume(buffer, mime, opts);
      console.log(
        JSON.stringify(
          {
            ms: Date.now() - t0,
            fullName: p.fullName,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            phone: p.phone,
            linkedinUrl: p.linkedinUrl,
            skillsCount: p.skills.length,
            skillsPreview: p.skills.slice(0, 12),
            summaryPreview: p.summary ? p.summary.slice(0, 240) : null,
            rawTextChars: p.rawText.length,
          },
          null,
          2
        )
      );
    } catch (e) {
      console.error("ERROR:", e instanceof Error ? e.message : String(e));
    }
  }

  console.log("─".repeat(64));
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
