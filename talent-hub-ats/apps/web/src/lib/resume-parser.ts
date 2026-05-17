/**
 * Resume Parser - Extracts structured data from PDF and DOCX files
 * Extracts: name, email, phone, skills, experience, education, LinkedIn URL
 */

// Lazy imports to avoid build-time issues
// unpdf works in Node.js, Edge, and browser without web-worker setup
let _mammoth: any = null;

async function getMammoth() {
  if (!_mammoth) {
    const mod = await import("mammoth");
    _mammoth = (mod as any).default ?? mod;
  }
  return _mammoth;
}

export interface ParsedResume {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  skills: string[];
  experience: ParsedExperience[];
  education: ParsedEducation[];
  summary: string | null;
  rawText: string;
}

export interface ParsedExperience {
  title: string;
  company: string;
  duration: string;
}

export interface ParsedEducation {
  degree: string;
  institution: string;
}

// Common tech skills for matching
const KNOWN_SKILLS = [
  // Languages
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust",
  "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R", "MATLAB", "Perl", "Shell",
  "Bash", "SQL", "HTML", "CSS", "Sass", "LESS",
  // Frontend
  "React", "Angular", "Vue", "Next.js", "Nuxt", "Svelte", "Redux", "GraphQL",
  "REST", "Tailwind", "Bootstrap", "Material UI", "Webpack", "Vite",
  // Backend
  "Node.js", "Express", "FastAPI", "Django", "Flask", "Spring", "Rails",
  "Laravel", "ASP.NET", "NestJS", "Fastify",
  // Databases
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "DynamoDB",
  "SQLite", "Cassandra", "Firebase", "Supabase", "Prisma",
  // Cloud & DevOps
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD",
  "Jenkins", "GitHub Actions", "GitLab CI", "Linux", "Nginx",
  // Data & ML
  "Machine Learning",
  "Deep Learning",
  "Computer Vision",
  "Data Analysis",
  "Knowledge Graphs",
  "Natural Language Processing",
  "Generative AI",
  "Large Language Models",
  "TensorFlow",
  "PyTorch",
  "Pandas",
  "NumPy",
  "Spark",
  "Hadoop",
  "Airflow",
  "dbt",
  "Tableau",
  "Power BI",
  "Snowflake",
  "Excel",
  // Tools
  "Git", "Jira", "Figma", "Sketch", "Postman", "Swagger",
  // Methodologies
  "Agile", "Scrum", "Kanban", "TDD", "Microservices", "Serverless",
];

// Skills that are common English words — use case-sensitive matching to avoid false positives
// e.g. "Go" should not match "go to" in prose, "R" should not match mid-sentence
const CASE_SENSITIVE_SKILLS = new Set(["Go", "R", "C", "Rust", "Spring", "Rails", "Scala", "Excel"]);

/** Multi-word skill labels (lowercase) — reject as a "name" line e.g. LinkedIn PDF section headers. */
const KNOWN_SKILL_PHRASES = new Set(
  KNOWN_SKILLS.map((s) => s.toLowerCase().replace(/\s+/g, " ").trim()).filter((s) => s.includes(" "))
);

/** One-word KNOWN_SKILLS entries (lowercase) — used to reject "React TypeScript Node" as a name. */
const SINGLE_WORD_SKILL_FOR_NAME = new Set(
  KNOWN_SKILLS.filter((s) => !/\s/.test(s) && s.length >= 2).map((s) => s.toLowerCase())
);

/**
 * Headline / role tokens — almost never the sole identity on a "name" line.
 * Stops "Senior Software Engineer" from being parsed as first+middle+last.
 */
const JOB_ROLE_TOKENS = new Set(
  [
    "senior",
    "junior",
    "lead",
    "principal",
    "staff",
    "intern",
    "graduate",
    "manager",
    "engineer",
    "developer",
    "architect",
    "consultant",
    "director",
    "specialist",
    "analyst",
    "designer",
    "scientist",
    "officer",
    "founder",
    "owner",
    "executive",
    "associate",
    "coordinator",
    "recruiter",
    "technologist",
    "programmer",
    "freelancer",
    "contractor",
    "vp",
    "cto",
    "ceo",
    "cfo",
    "coo",
    "evp",
    "svp",
    "head",
    "chief",
    "president",
    "vice",
    "full",
    "stack",
    "frontend",
    "front",
    "backend",
    "back",
    "devops",
    "scrum",
    "master",
    "software",
    "hardware",
    "network",
    "security",
    "quality",
    "product",
    "project",
    "program",
    "marketing",
    "sales",
    "business",
    "digital",
    "creative",
    "experience",
    "ux",
    "ui",
    "remote",
    "hybrid",
    "onsite",
    "consulting",
    "management",
    "knowledge",
    "limited",
    "working",
    "sanskrit",
    "fluent",
    "native",
    "proficiency",
  ].map((w) => w.toLowerCase())
);

/** Case-sensitive skill tokens that are also common in headlines (exact match on word). */
const CASE_SENSITIVE_SKILL_NAME_BLOCK = new Set(["Go", "R", "C"]);

/** LinkedIn PDFs interleave certifications and skill headers before the real name. */
function lineSmellsLikeLinkedInNoise(name: string): boolean {
  const lower = name.toLowerCase();
  if (
    /\b(specialization|specialisation|certificate|certification|credential|newcomer|honoree|badge|scholarship|fellowship)\b/.test(
      lower
    )
  ) {
    return true;
  }
  if (
    /\bbased\b/.test(lower) &&
    /transformer|graph|language|model|llm|neural|deep\s+learning/i.test(name)
  ) {
    return true;
  }
  if (/\btransformer\b/i.test(name)) return true;
  if (/\bolympiad\b/i.test(lower) || /\bphysics\b/i.test(lower)) return true;
  if (/\bprocessing\b/i.test(lower) && /\b(language|natural|data|text|nlp)\b/i.test(lower)) {
    return true;
  }
  if (/\bapplications\b/i.test(lower) && /\b(processing|learning|ml|ai)\b/i.test(lower)) {
    return true;
  }
  for (const phrase of KNOWN_SKILL_PHRASES) {
    if (lower === phrase) return true;
    if (lower.startsWith(`${phrase} `) || lower.startsWith(`${phrase},`)) return true;
  }
  return false;
}

/**
 * Reject extracted "names" that are clearly skills or job titles (common PDF/LinkedIn layout bug).
 */
function passesNamePlausibility(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 60) return false;
  if (lineSmellsLikeLinkedInNoise(trimmed)) return false;

  const words = trimmed
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z]+|[^A-Za-z.-]+$/g, ""))
    .filter((w) => w.length > 0);
  if (words.length < 2 || words.length > 6) return false;

  for (const w of words) {
    const lower = w.toLowerCase();
    if (JOB_ROLE_TOKENS.has(lower)) return false;
  }

  let skillLike = 0;
  for (const w of words) {
    const lower = w.toLowerCase();
    if (SINGLE_WORD_SKILL_FOR_NAME.has(lower)) skillLike++;
    else if (CASE_SENSITIVE_SKILL_NAME_BLOCK.has(w)) skillLike++;
  }

  if (words.length >= 2 && skillLike >= words.length) return false;
  if (words.length >= 3 && skillLike >= Math.ceil((words.length * 2) / 3)) return false;

  return true;
}

// Lines that look like names but are resume section headers — skip them
const RESUME_HEADER_WORDS = new Set([
  "curriculum vitae", "resume", "cv", "profile", "contact", "contacts",
  "summary", "objective", "experience", "education", "skills", "about me",
  "about", "overview", "introduction", "personal information", "personal details",
  // LinkedIn PDF export often leads with this section label
  "top skills",
  "languages",
  "certifications",
  "licenses",
  "interests",
  "management consulting",
  "knowledge graph-based",
  "sanskrit limited working",
]);

/** If unpdf yields less than this many characters, try OCR (image-based / LinkedIn-style PDFs). */
const MIN_PDF_TEXT_BEFORE_OCR = 120;
/** OCR is slow; cap pages (LinkedIn exports are usually 1–3 pages). */
const OCR_MAX_PAGES = 3;

export type ParseResumeOptions = {
  /**
   * When true, skip **optional** OCR (text exists but fails quality heuristics).
   * **Thin or failed extraction** still runs OCR by default (unless `RESUME_PDF_OCR` is off).
   */
  skipPdfOcr?: boolean;
};

/**
 * Middle gate: unpdf sometimes returns long strings that are mostly junk (glyphs, bad encoding).
 * If this fails, we still try OCR even when character count is above the minimum.
 */
function unpdfTextLooksUsable(text: string): boolean {
  const t = text.trim();
  if (t.length < 80) return false;
  const letters = t.replace(/[^A-Za-z]/g, "").length;
  if (letters / t.length < 0.22) return false;
  const tokens = t.match(/[A-Za-z]{2,}/g);
  if (!tokens || tokens.length < 8) return false;
  if (!/\s/.test(t.slice(0, Math.min(500, t.length)))) return false;
  return true;
}

/**
 * Render PDF pages to PNG and run Tesseract. Used when text extraction is thin or empty
 * (e.g. LinkedIn profile PDFs that are mostly graphics).
 */
async function ocrPdfToText(buffer: Buffer, maxPages: number): Promise<string> {
  const { pdf } = await import("pdf-to-img");
  const { createWorker } = await import("tesseract.js");
  const doc = await pdf(buffer, { scale: 1.75 });
  const worker = await createWorker("eng");
  const parts: string[] = [];
  try {
    let pageNum = 0;
    for await (const pagePng of doc) {
      pageNum++;
      if (pageNum > maxPages) break;
      const {
        data: { text },
      } = await worker.recognize(pagePng);
      parts.push(text);
    }
  } finally {
    await worker.terminate();
  }
  return parts.join("\n\n").trim();
}

const MAX_MERGED_PDF_CHARS = 50_000;

function normalizeLineForDedupe(line: string): string {
  return line.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Combine unpdf + OCR text: keep all unique lines in order (unpdf first, then OCR-only lines).
 * Avoids choosing one source when each has different fragments (e.g. headers in text layer, body in OCR).
 */
export function mergePdfTextSources(unpdfText: string, ocrText: string): string {
  const a = unpdfText.trim();
  const b = ocrText.trim();
  if (!a) return b;
  if (!b) return a;

  const seen = new Set<string>();
  const out: string[] = [];

  const pushUniqueLines = (block: string) => {
    for (const line of block.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length < 2) continue;
      const key = normalizeLineForDedupe(trimmed);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
  };

  pushUniqueLines(a);
  pushUniqueLines(b);

  let merged = out.join("\n");
  if (merged.length > MAX_MERGED_PDF_CHARS) {
    merged = merged.slice(0, MAX_MERGED_PDF_CHARS);
  }
  return merged;
}

async function extractPdfRawText(
  buffer: Buffer,
  options?: ParseResumeOptions
): Promise<string> {
  let rawText = "";
  let unpdfError: Error | null = null;

  try {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(buffer), { mergePages: false });
    const pages: string[] = Array.isArray(result?.text) ? result.text : [result?.text ?? ""];
    rawText = pages.join("\n\n").trim();
  } catch (e) {
    unpdfError = e instanceof Error ? e : new Error(String(e));
  }

  const ocrDisabledByEnv =
    process.env.RESUME_PDF_OCR === "0" || process.env.RESUME_PDF_OCR === "false";

  const tooShort = rawText.length < MIN_PDF_TEXT_BEFORE_OCR;
  const extractFailed = unpdfError !== null;
  const looksBad =
    !tooShort &&
    !extractFailed &&
    rawText.length >= MIN_PDF_TEXT_BEFORE_OCR &&
    !unpdfTextLooksUsable(rawText);

  // Mandatory: little/no usable extraction — OCR on by default (checkbox does not skip).
  const needsOcrMandatory =
    !ocrDisabledByEnv && (tooShort || extractFailed);
  // Optional: enough chars but junk-like — respect skipPdfOcr from the UI.
  const needsOcrOptional =
    !ocrDisabledByEnv &&
    options?.skipPdfOcr !== true &&
    looksBad;

  const needsOcr = needsOcrMandatory || needsOcrOptional;

  if (needsOcr) {
    try {
      const ocrText = await ocrPdfToText(buffer, OCR_MAX_PAGES);
      if (ocrText.trim()) {
        rawText = mergePdfTextSources(rawText, ocrText);
      }
    } catch {
      // Keep unpdf result or rethrow below if nothing usable
    }
  }

  if (!rawText.trim()) {
    const msg = unpdfError?.message ?? "";
    throw new Error(
      msg.includes("Invalid") || msg.includes("Could not")
        ? "This PDF could not be read. It may be scanned or image-based with no selectable text."
        : msg || "No text could be extracted from this PDF. It may be scanned or image-based. Try adding details manually."
    );
  }

  return rawText;
}

export async function parseResume(
  buffer: Buffer,
  mimeType: string,
  options?: ParseResumeOptions
): Promise<ParsedResume> {
  let rawText = "";

  if (mimeType === "application/pdf") {
    rawText = await extractPdfRawText(buffer, options);
  } else if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    // .docx (Office Open XML / zip-based) — mammoth handles this well
    const mammoth = await getMammoth();
    try {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value ?? "";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Could not read DOCX file. It may be corrupted. Details: ${msg}`
      );
    }
  } else if (mimeType === "application/msword") {
    // Old binary .doc format — mammoth may work for some files,
    // but it natively targets .docx. Try it, and if it fails give a clear hint.
    const mammoth = await getMammoth();
    try {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value ?? "";
    } catch {
      // Binary .doc parsing failed. Try extracting printable ASCII as a last resort.
      const ascii = buffer
        .toString("latin1")
        .replace(/[^\x20-\x7E\n\r\t]/g, " ")
        .replace(/\s{3,}/g, "  ")
        .trim();
      if (ascii.length > 100) {
        rawText = ascii;
      } else {
        throw new Error(
          "Old .doc format could not be read. Please save the file as .docx (Word 2007+) and re-upload."
        );
      }
    }
  } else {
    // Plain text fallback
    rawText = buffer.toString("utf-8");
  }

  // cleanText collapses all whitespace — good for regex searches on skills/email/phone.
  // extractName needs the original line-by-line structure (rawText), not cleanText.
  const cleanText = rawText.replace(/\s+/g, " ").trim();
  const fullName = extractName(rawText); // use rawText so line breaks are preserved

  return {
    fullName,
    firstName: fullName?.split(" ")[0] || null,
    lastName: fullName?.split(" ").slice(1).join(" ") || null,
    email: extractEmail(cleanText),
    phone: extractPhone(cleanText),
    location: extractLocation(rawText),
    linkedinUrl: extractLinkedIn(cleanText),
    portfolioUrl: extractPortfolio(cleanText),
    skills: extractSkills(cleanText),
    experience: extractExperience(rawText),
    education: extractEducation(rawText),
    summary: extractSummary(rawText),
    rawText: cleanText.slice(0, 10000), // Cap stored text
  };
}

function extractEmail(text: string): string | null {
  const match = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  return match ? match[0].toLowerCase() : null;
}

/** Rejects tenure lines like "2022-2023" that matched the loose phone pattern. */
function looksLikeYearRangeNotPhone(s: string): boolean {
  const compact = s.replace(/\s/g, "");
  const m = compact.match(/^(\d{4})[-–/](\d{4})$/);
  if (!m) return false;
  const y1 = parseInt(m[1], 10);
  const y2 = parseInt(m[2], 10);
  return y1 >= 1900 && y1 <= 2100 && y2 >= 1900 && y2 <= 2100;
}

function extractPhone(text: string): string | null {
  // Matches international formats: +91 07974052208, (+91) 07974052208,
  // US: (123) 456-7890, +1-800-555-1234, UK: +44 20 7946 0958
  const re =
    /(?:\(?\+?\d{1,3}\)?[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{4,6}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const cleaned = m[0].replace(/\s{2,}/g, " ").trim();
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) continue;
    if (looksLikeYearRangeNotPhone(cleaned)) continue;
    return cleaned;
  }
  return null;
}

function extractLinkedIn(text: string): string | null {
  // Handle dots in vanity URLs and strip tracking params at ?/# boundaries
  const match = text.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_.-]+\/?(?=[?#\s]|$)/i
  );
  if (match) {
    const url = match[0].replace(/\/$/, ""); // normalise trailing slash
    return url.startsWith("http") ? url : `https://${url}`;
  }
  return null;
}

function extractPortfolio(text: string): string | null {
  const match = text.match(
    /(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org)\/[a-zA-Z0-9_-]+\/?/i
  );
  if (match) {
    const url = match[0];
    return url.startsWith("http") ? url : `https://${url}`;
  }
  return null;
}

/** LinkedIn / CV self-intro lines often contain the real name before skill headers. */
function extractNameFromSelfIntro(text: string): string | null {
  const window = text.slice(0, 15000);
  const patterns = [
    /\bHello,?\s+I'm\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/,
    /\bI'm\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/,
    /\bI am\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/,
    /\bMy name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/,
  ];
  for (const re of patterns) {
    const m = window.match(re);
    if (!m) continue;
    const candidate = m[1].trim();
    if (passesNamePlausibility(candidate)) return candidate;
  }
  return null;
}

function stripCredentialSuffix(line: string): string {
  return line
    .replace(
      /,?\s*(PhD|Ph\.D\.|MD|M\.D\.|MBA|B\.Tech|M\.Tech|M\.S\.?|B\.S\.|B\.E\.|M\.E\.)\s*$/i,
      ""
    )
    .trim();
}

/**
 * LinkedIn "Save to PDF" layout: display name on one line, headline on the next (headline contains @).
 * The name block appears after Contact / skills / certs on page 1 — earlier heuristics often miss it.
 */
function extractLinkedInPdfNameBeforeHeadline(text: string): string | null {
  const lines = text.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
  const max = Math.min(lines.length - 1, 200);

  for (let i = 0; i < max; i++) {
    const raw = lines[i];
    const next = lines[i + 1];
    if (!next.includes("@")) continue;
    if (raw.includes("@")) continue;
    if (/^https?:\/\//i.test(raw)) continue;
    if (/linkedin\.com/i.test(raw) || /\.github\.io/i.test(raw)) continue;
    if (RESUME_HEADER_WORDS.has(raw.toLowerCase())) continue;

    const stripped = stripCredentialSuffix(raw);
    const alphaOnly = stripped.replace(/[^a-zA-Z\s.-]/g, "").trim();
    if (alphaOnly.length < 4 || alphaOnly.length > 85) continue;

    const words = alphaOnly.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;
    if (!passesNamePlausibility(alphaOnly)) continue;

    return alphaOnly;
  }
  return null;
}

function extractName(text: string): string | null {
  // The name is typically the first meaningful line of a resume.
  // Handles: Title Case, ALL CAPS, honorifics (Dr./Mr./Ms.),
  // hyphenated names (Mary-Jane), initials (J. K. Rowling), middle names.
  const fromIntro = extractNameFromSelfIntro(text);
  if (fromIntro) return fromIntro;

  const fromLiPdf = extractLinkedInPdfNameBeforeHeadline(text);
  if (fromLiPdf) return fromLiPdf;

  const lines = text.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);

  // Convert ALL-CAPS string to Title Case
  const toTitleCase = (s: string) =>
    s.replace(/\b([A-Z]+)\b/g, (w) => w[0] + w.slice(1).toLowerCase());

  // A single name word: starts with uppercase, optional lowercase letters,
  // optional trailing period, optional hyphenated continuation (Mary-Jane, Jean-Pierre)
  const NAME_WORD = /^[A-Z][a-z]*\.?(?:-[A-Z][a-z]*\.?)*$/;
  // An ALL-CAPS word: 2+ uppercase letters only
  const CAPS_WORD = /^[A-Z]{2,}$/;

  const looksLikeName = (words: string[]): "title" | "caps" | null => {
    if (words.length < 2 || words.length > 5) return null;
    const phrase = words.join(" ").toLowerCase();
    if (RESUME_HEADER_WORDS.has(phrase)) return null;
    if (KNOWN_SKILL_PHRASES.has(phrase)) return null;
    if (words.every((w) => NAME_WORD.test(w))) return "title";
    if (words.every((w) => CAPS_WORD.test(w))) return "caps";
    return null;
  };

  // Pass 1: whole line must be a clean name (most confident)
  // Scan up to 20 lines — some PDFs emit metadata or contact lines before the name
  for (const line of lines.slice(0, 20)) {
    const cleaned = line.replace(/[^a-zA-Z\s.-]/g, "").trim();
    if (!cleaned || cleaned.length > 50 || cleaned.length < 3) continue;
    const words = cleaned.split(/\s+/);
    const kind = looksLikeName(words);
    if (kind === "title" && passesNamePlausibility(cleaned)) return cleaned;
    if (kind === "caps") {
      const titled = toTitleCase(cleaned);
      if (passesNamePlausibility(titled)) return titled;
    }
  }

  // Pass 2: name may be the FIRST 2-4 words of a longer line (e.g. "NEHA SINGH | Manager | Mumbai")
  // Scan up to 12 lines to cover PDFs where name is on a mixed header line
  for (const line of lines.slice(0, 12)) {
    // Strip separators (|, •, /, —) to get plain alpha words
    const cleaned = line.replace(/[^a-zA-Z\s.-]/g, " ").replace(/\s{2,}/g, " ").trim();
    if (!cleaned) continue;
    const allWords = cleaned.split(/\s+/);

    for (const len of [2, 3, 4]) {
      if (allWords.length <= len) continue; // must be longer than len for this to be a prefix
      const candidate = allWords.slice(0, len);
      const kind = looksLikeName(candidate);
      const joined = candidate.join(" ");
      if (kind === "title" && passesNamePlausibility(joined)) return joined;
      if (kind === "caps") {
        const titled = toTitleCase(joined);
        if (passesNamePlausibility(titled)) return titled;
      }
    }
  }

  // Pass 3: explicit "Name:" or "Full Name:" label anywhere in the doc
  const nameMatch = text.match(/(?:name|full\s*name)\s*[:\-]\s*([A-Z][a-zA-Z\s.]+)/i);
  if (nameMatch) {
    const candidate = nameMatch[1].trim().slice(0, 50);
    const final = /^[A-Z\s]+$/.test(candidate) ? toTitleCase(candidate) : candidate;
    if (passesNamePlausibility(final)) return final;
  }

  return null;
}

function extractSkills(text: string): string[] {
  const found: string[] = [];

  for (const skill of KNOWN_SKILLS) {
    // Use case-sensitive matching for short/ambiguous skill names to avoid false positives
    const flags = CASE_SENSITIVE_SKILLS.has(skill) ? "" : "i";
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, flags);
    if (regex.test(text)) {
      found.push(skill);
    }
  }

  // Also extract skills listed explicitly in a "Skills:" section
  const skillsSection = text.match(
    /(?:skills|technical\s+skills|core\s+competencies|technologies)\s*[:\-]\s*([^\n]+(?:\n[^\n]+)*)/i
  );
  if (skillsSection) {
    const sectionSkills = skillsSection[1]
      .split(/[,;|•·\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 30);
    for (const s of sectionSkills) {
      if (!found.some((f) => f.toLowerCase() === s.toLowerCase())) {
        found.push(s);
      }
    }
  }

  return [...new Set(found)].slice(0, 30);
}

function extractLocation(text: string): string | null {
  // Explicit "Location:" or "City:" label
  const labelMatch = text.match(/(?:^|\n)(?:location|city)\s*[:\-]\s*([^\n,]+)/i);
  if (labelMatch) return labelMatch[1].trim().slice(0, 60);

  // Extract city from "Current Address:" / "Address:" line.
  // The city is the last comma-separated segment before an optional postal code.
  // e.g. "Platinum Tower 1, DN Nagar, Andheri West, Mumbai – 400053" → "Mumbai"
  const addrMatch = text.match(
    /(?:current\s+)?address\s*[:\-][^\n]+,\s*([A-Za-z][a-zA-Z\s]+?)(?:\s*[–\-]\s*\d{3,}|\s*\n|$)/i
  );
  if (addrMatch) return addrMatch[1].trim().slice(0, 60);

  return null;
}

function clampResumeField(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max);
}

/** LinkedIn PDF export: "July 2025 - Present" or "April 2023 - July 2025 (2 years 4 months)" */
const LINKEDIN_MONTH_DATE =
  /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[-–—]\s*(?:Present|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i;

function isLinkedInMonthDateLine(line: string): boolean {
  return LINKEDIN_MONTH_DATE.test(line.trim());
}

function isTenureSummaryLine(line: string): boolean {
  const t = line.trim();
  return (
    /^\d+\s+years?\s+\d+\s+months?$/i.test(t) ||
    /^\d+\s+years?\s+\d+\s+month$/i.test(t) ||
    /^\d+\s+year\s+\d+\s+months?$/i.test(t) ||
    /^\d+\s+years?$/i.test(t) ||
    /^\d+\s+months?$/i.test(t)
  );
}

function isAcademicOrgLine(line: string): boolean {
  const t = line.trim();
  return (
    /^(IIT|IIM|IIIT|XLRI|NIT|BITS)\b/i.test(t) ||
    /\bIndian Institute of Technology\b/i.test(t) ||
    /\bIndian Institute of Management\b/i.test(t) ||
    /^Indian Institute\b/i.test(t)
  );
}

function shouldSkipLinkedInExperienceNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^Page\s+\d+\s+of\s+\d+$/i.test(t)) return true;
  if (/^Patents?$/i.test(t) || /^Publications?$/i.test(t)) return true;
  if (t.length > 220) return true;
  if (t.length > 40 && t === t.toUpperCase() && /[A-Z]{3,}/.test(t)) return true;
  if (/^--/.test(t) || /^[-•]\s/.test(t)) return true;
  if (/^Courses?:/i.test(t)) return true;
  if (
    /^(Leading |Previously |Worked |Built |Designed |Driving |Also |Research has |In parallel |Part of |Clients:|Team:|Teams:|Teaching Assistant|Built a graph|Global Analytics)/i.test(
      t
    )
  ) {
    return true;
  }
  if (/^decision process:/i.test(t) || /^Personalize,/i.test(t)) return true;
  if (/^Academic research$/i.test(t)) return true;
  if (t.length < 70 && /^[a-z]/.test(t)) return true;
  return false;
}

function couldBeLinkedInCompanyLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 120) return false;
  if (/^Batch:|^Courses?:|^Batches?:|^Course:/i.test(t)) return false;
  if (isLinkedInMonthDateLine(t) || isTenureSummaryLine(t)) return false;
  if (/^--|^[-•]/.test(t)) return false;
  if (/^(Doctor|Master|Bachelor|B\.E|Summer School|Ph\.D)\b/i.test(t)) return false;
  // Bullet prose mistaken for an employer (PayPal → Manager I)
  if (/\band more\.?$/i.test(t)) return false;
  if (/\b(universities|collaboration|publications)\b/i.test(t)) return false;
  return true;
}

function couldBeLinkedInJobTitle(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 130) return false;
  if (isLinkedInMonthDateLine(t) || isTenureSummaryLine(t)) return false;
  if (/^--|^[-•]/.test(t)) return false;
  if (/^(Leading |Built |Designed |Part of |Clients:|Team:|Teams:|Worked |Also |Previously )/i.test(t)) {
    return false;
  }
  if (/^[a-z]/.test(t) && t.length > 40) return false;
  // Org lines misread as titles — avoid tokens that appear inside normal job titles (e.g. "Machine Learning").
  if (
    /\b(Chamber of|Corporation|Foundation|Association|Society|Ministry|Government|Consultancy Services)\b/i.test(t)
  ) {
    return false;
  }
  return true;
}

function isLikelyLinkedInLocationLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 95) return false;
  if (isLinkedInMonthDateLine(t)) return false;
  if (/^--|^[-•]/.test(t)) return false;
  if (/\b(Area|India|Remote|Hybrid|United States|USA|UK|Canada)\b/i.test(t)) return true;
  if (/,\s*[A-Za-z]/.test(t) && t.length < 90) return true;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length <= 3 && words.every((w) => /^[A-Za-z][A-Za-z.-]*$/.test(w));
}

function skipLinkedInBatchCourseLines(lines: string[], start: number): number {
  let i = start;
  while (i < lines.length && /^(batch|batches|courses?|course):/i.test(lines[i].trim())) {
    i++;
  }
  return i;
}

function linkedInCompanyBlockPeek(lines: string[], k: number): boolean {
  if (k >= lines.length || !couldBeLinkedInCompanyLine(lines[k])) return false;
  let j = k + 1;
  if (j < lines.length && isTenureSummaryLine(lines[j])) j++;
  if (j + 1 >= lines.length) return false;
  return couldBeLinkedInJobTitle(lines[j]) && isLinkedInMonthDateLine(lines[j + 1]);
}

function tryConsumeLinkedInCompanyBlock(
  lines: string[],
  start: number
): { consumed: ParsedExperience[]; next: number } | null {
  const L = lines[start];
  if (!couldBeLinkedInCompanyLine(L) || /\bvisiting\s+faculty\b/i.test(L)) return null;
  let j = start + 1;
  if (j < lines.length && isTenureSummaryLine(lines[j])) j++;
  if (j + 1 >= lines.length) return null;
  if (!couldBeLinkedInJobTitle(lines[j]) || !isLinkedInMonthDateLine(lines[j + 1])) return null;

  const company = clampResumeField(L, 100);
  const consumed: ParsedExperience[] = [];
  let k = j;
  while (k < lines.length) {
    while (k < lines.length && shouldSkipLinkedInExperienceNoiseLine(lines[k])) k++;
    if (k + 1 >= lines.length) break;
    if (!couldBeLinkedInJobTitle(lines[k])) break;
    if (!isLinkedInMonthDateLine(lines[k + 1])) {
      // Next line is not a tenure date — either a new employer row or a subtitle; do not skip real company lines.
      if (couldBeLinkedInCompanyLine(lines[k])) break;
      k++;
      continue;
    }
    const title = clampResumeField(lines[k], 100);
    const duration = clampResumeField(lines[k + 1], 140);
    k += 2;
    if (k < lines.length && isLikelyLinkedInLocationLine(lines[k])) k++;
    consumed.push({ title, company, duration });
    while (k < lines.length && shouldSkipLinkedInExperienceNoiseLine(lines[k])) k++;
    if (k < lines.length && linkedInCompanyBlockPeek(lines, k)) break;
  }
  return { consumed, next: k };
}

function extractLinkedInStyleExperience(text: string): ParsedExperience[] {
  const expHeader = /(?:^|\n)experience\s*\r?\n/i.exec(text);
  if (!expHeader) return [];

  const rest = text.slice(expHeader.index + expHeader[0].length);
  const endRel = rest.search(
    /\r?\n(?=education\s*\r?\n|skills\s*\r?\n|volunteer\s*\r?\n|interests\s*\r?\n|projects\s*\r?\n)/i
  );
  const section = endRel >= 0 ? rest.slice(0, endRel) : rest.slice(0, 16000);

  let lines = section.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines = lines.filter((l) => !/^Page\s+\d+\s+of\s+\d+$/i.test(l));

  const out: ParsedExperience[] = [];
  let i = 0;
  let visitingTitle: string | null = null;

  while (i < lines.length) {
    const L = lines[i];
    if (shouldSkipLinkedInExperienceNoiseLine(L)) {
      i++;
      continue;
    }

    if (
      i + 3 < lines.length &&
      /\bvisiting\s+faculty\b/i.test(L) &&
      isTenureSummaryLine(lines[i + 1]) &&
      isAcademicOrgLine(lines[i + 2]) &&
      isLinkedInMonthDateLine(lines[i + 3])
    ) {
      visitingTitle = clampResumeField(L, 100);
      out.push({
        title: visitingTitle,
        company: clampResumeField(lines[i + 2], 100),
        duration: clampResumeField(lines[i + 3], 140),
      });
      i = skipLinkedInBatchCourseLines(lines, i + 4);
      continue;
    }

    if (
      visitingTitle &&
      i + 1 < lines.length &&
      isAcademicOrgLine(L) &&
      isLinkedInMonthDateLine(lines[i + 1])
    ) {
      out.push({
        title: visitingTitle,
        company: clampResumeField(L, 100),
        duration: clampResumeField(lines[i + 1], 140),
      });
      i = skipLinkedInBatchCourseLines(lines, i + 2);
      continue;
    }

    const block = tryConsumeLinkedInCompanyBlock(lines, i);
    if (block && block.consumed.length > 0) {
      visitingTitle = null;
      out.push(...block.consumed);
      i = block.next;
      continue;
    }

    i++;
  }

  return out;
}

function dedupeParsedExperiences(items: ParsedExperience[]): ParsedExperience[] {
  const seen = new Set<string>();
  const out: ParsedExperience[] = [];
  for (const x of items) {
    const k = `${x.title.toLowerCase()}|${x.company.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function extractExperienceIndianLayout(text: string): ParsedExperience[] {
  const experiences: ParsedExperience[] = [];
  const seen = new Set<string>();

  const SECTION_HEADERS = new Set([
    "experience", "education", "skills", "summary", "objective", "references",
    "about me", "about", "profile", "overview", "introduction",
  ]);

  const roleCompanyPattern =
    /^([A-Z][a-zA-Z \t&.,'–\-]+?)\n([A-Z][a-zA-Z \t&.,']+?)\s*\((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^)]*\)/gm;

  let match;
  while ((match = roleCompanyPattern.exec(text)) !== null && experiences.length < 10) {
    const roleLine = match[1].trim();
    const company = match[2].trim();

    if (SECTION_HEADERS.has(roleLine.toLowerCase())) continue;

    const roleWords = roleLine.split(/\s+/);
    const lastWord = roleWords[roleWords.length - 1];
    const isTrailingCity =
      roleWords.length > 1 && /^[A-Z][a-z]{2,}$/.test(lastWord);
    let title = isTrailingCity
      ? roleWords.slice(0, -1).join(" ").replace(/\s*[–\-]\s*$/, "").trim()
      : roleLine;

    const key = `${title.toLowerCase()}|${company.toLowerCase()}`;
    if (!seen.has(key) && title.length > 1 && title.length < 80 && company.length < 80) {
      seen.add(key);
      experiences.push({ title, company, duration: "" });
    }
  }

  const atPattern =
    /(?:^|\n)\s*([A-Z][a-zA-Z\s]{2,40}?)\s+at\s+([A-Z][a-zA-Z\s&.]{2,40})\s*(?:\n|$)/gm;
  while ((match = atPattern.exec(text)) !== null && experiences.length < 10) {
    const title = match[1].trim();
    const company = match[2].trim();
    const key = `${title.toLowerCase()}|${company.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      experiences.push({ title, company, duration: "" });
    }
  }

  return experiences.slice(0, 5);
}

function extractExperience(text: string): ParsedExperience[] {
  const linkedIn = extractLinkedInStyleExperience(text);
  const indian = extractExperienceIndianLayout(text);
  if (linkedIn.length > 0) {
    // LinkedIn PDFs often list many adjunct rows before full-time roles; keep a higher cap than Indian CV layout.
    return dedupeParsedExperiences([...linkedIn, ...indian]).slice(0, 25);
  }
  return indian;
}

function hasLinkedInEducationYearRange(s: string): boolean {
  return /·\s*\(\s*\d{4}\s*[-–]\s*\d{4}/.test(s) || /\(\s*\d{4}\s*[-–]\s*\d{4}\s*\)/.test(s);
}

function nextLineLooksLikeLinkedInEducationInstitution(line: string): boolean {
  const t = line.trim();
  if (/·\s*\(\s*\d{4}/.test(t)) return false;
  if (
    /^(Doctor|Master|Bachelor|B\.E|Summer|Ph\.D|Diploma|Postgraduate|Undergraduate|Certificate|High School)/i.test(t)
  ) {
    return false;
  }
  return (
    /\b(university|institute of|institute,|college|school of|iit|iim|iiit|bits|nit|academy)\b/i.test(t) ||
    /^Indian Institute\b/i.test(t)
  );
}

function extractLinkedInStyleEducation(text: string): ParsedEducation[] {
  const eduHeader = /(?:^|\n)education\s*\r?\n/i.exec(text);
  if (!eduHeader) return [];

  const rest = text.slice(eduHeader.index + eduHeader[0].length);
  const endRel = rest.search(
    /\r?\n(?=skills\s*\r?\n|experience\s*\r?\n|interests\s*\r?\n|honors\s|volunteer\s*\r?\n|projects\s*\r?\n|licenses\s)/i
  );
  const section = endRel >= 0 ? rest.slice(0, endRel) : rest.slice(0, 10000);

  const lines = section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^Page\s+\d+\s+of\s+\d+$/i.test(l));

  const items: ParsedEducation[] = [];
  let i = 0;
  while (i < lines.length) {
    const inst = lines[i++];
    if (/^education$/i.test(inst)) continue;
    const degParts: string[] = [];
    while (i < lines.length) {
      const L = lines[i];
      if (degParts.length > 0) {
        const joined = degParts.join(" ");
        if (hasLinkedInEducationYearRange(joined) && nextLineLooksLikeLinkedInEducationInstitution(L)) {
          break;
        }
      }
      degParts.push(L);
      i++;
      if (hasLinkedInEducationYearRange(L)) break;
    }
    const degree = degParts.join(" ").replace(/\s+/g, " ").trim();
    if (inst && degree) {
      items.push({
        degree: degree.slice(0, 200),
        institution: inst.slice(0, 120),
      });
    }
  }
  return items;
}

function dedupeParsedEducation(items: ParsedEducation[]): ParsedEducation[] {
  const seen = new Set<string>();
  const out: ParsedEducation[] = [];
  for (const x of items) {
    const k = `${x.institution.toLowerCase()}|${x.degree.toLowerCase().slice(0, 80)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function extractEducationRegexFallback(text: string): ParsedEducation[] {
  const education: ParsedEducation[] = [];
  const seen = new Set<string>();

  const degreePattern =
    /(?<!\w)(?:Bachelor|Master|PhD|Ph\.D|MBA|B\.S\.|M\.S\.|B\.A\.|M\.A\.|B\.E\.|M\.E\.|B\.Tech|M\.Tech|B\.P\.Ed|M\.P\.Ed|B\.Ed|M\.Ed)(?:[^,\n]{0,60}?)(?:\bfrom\b|\bat\b|,)\s*([A-Z][a-zA-Z\s&]{2,50})/gi;

  let match;
  while ((match = degreePattern.exec(text)) !== null && education.length < 8) {
    const degree = match[0].trim().slice(0, 100);
    const institution = match[1]?.trim().slice(0, 80) || "";
    const key = degree.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      education.push({ degree, institution });
    }
  }

  const institutionPattern =
    /(?:University|College|Institute|IIT|NIT|BITS|School\s+of)\s+(?:of\s+)?[A-Z][a-zA-Z\s&]{2,50}/gi;

  while ((match = institutionPattern.exec(text)) !== null && education.length < 8) {
    const degree = match[0].trim().replace(/\s+[A-Z]$/, "").slice(0, 100);
    const key = degree.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      education.push({ degree, institution: "" });
    }
  }

  return education;
}

function extractEducation(text: string): ParsedEducation[] {
  const linkedIn = extractLinkedInStyleEducation(text);
  const regexEd = extractEducationRegexFallback(text);
  if (linkedIn.length > 0) {
    return dedupeParsedEducation([...linkedIn, ...regexEd]).slice(0, 5);
  }
  return regexEd.slice(0, 3);
}

const MAX_SUMMARY_CHARS = 4000;

function extractSummary(text: string): string | null {
  // Handles: "PROFESSIONAL SUMMARY:", "ABOUT ME:", "Objective:", "Profile:", etc.
  // "about\s+me" must come before bare "about" so the longer form matches first
  // Prefer capturing until a major section (LinkedIn PDF: Summary → Experience).
  const withSectionEnd = text.match(
    /(?:professional\s+)?(?:summary|objective|about\s+me|about|profile|overview|introduction)\s*[:\-]?\s*(?:\r?\n)+\s*([\s\S]*?)(?=\r?\n\s*(?:Experience|Education|Employment|Work\s+History)\s*\r?\n)/i
  );
  if (withSectionEnd?.[1]?.trim()) {
    return withSectionEnd[1]
      .trim()
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, MAX_SUMMARY_CHARS);
  }

  const summaryMatch = text.match(
    /(?:professional\s+)?(?:summary|objective|about\s+me|about|profile|overview|introduction)\s*[:\-]?\s*\r?\n?\s*([^\n]+(?:\r?\n[^\n]+){0,24})/i
  );
  if (summaryMatch) {
    return summaryMatch[1].trim().slice(0, MAX_SUMMARY_CHARS);
  }
  return null;
}

/**
 * Score a candidate's resume against job requirements.
 * Returns a 0-100 score based on keyword/skill overlap.
 */
export function scoreResumeAgainstJob(
  resumeSkills: string[],
  resumeText: string,
  jobDescription: string,
  jobRequirements: string
): number {
  const jobText = `${jobDescription} ${jobRequirements}`.toLowerCase();
  const resumeTextLower = resumeText.toLowerCase();

  const jobSkills: string[] = [];
  for (const skill of KNOWN_SKILLS) {
    if (jobText.includes(skill.toLowerCase())) {
      jobSkills.push(skill.toLowerCase());
    }
  }

  if (jobSkills.length === 0) return 50; // No skills to match against

  let matches = 0;
  for (const skill of jobSkills) {
    if (
      resumeSkills.some((s) => s.toLowerCase() === skill) ||
      resumeTextLower.includes(skill)
    ) {
      matches++;
    }
  }

  const rawScore = (matches / jobSkills.length) * 100;
  return Math.round(Math.min(rawScore, 100));
}
