import { chat, chatWithImages, type ScreenshotInput } from "./client";
import {
  FILE_LIST_PROMPT,
  FILE_CONTENT_PROMPT,
  FILE_MODIFY_PROMPT,
  NEW_FILES_FOR_MODIFY_PROMPT,
} from "@/lib/prompts/code";

export type GeneratedFile = { path: string; content: string; isModified?: boolean };

/**
 * Ask the model for the list of file paths needed (new-code mode).
 */
async function getFileList(prd: string, designSpec: string): Promise<string[]> {
  const userContent = `## PRD\n\n${prd}\n\n## Design spec\n\n${designSpec}`;
  const raw = await chat(
    [
      { role: "system", content: FILE_LIST_PROMPT },
      { role: "user", content: userContent },
    ],
    { jsonMode: true }
  );

  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

  const parsed = JSON.parse(cleaned) as { files?: string[] };
  if (!Array.isArray(parsed.files)) return [];
  return parsed.files.filter((f) => typeof f === "string" && f.trim().length > 0);
}

/**
 * Generate the content of a single new file.
 */
async function getFileContent(
  filePath: string,
  prd: string,
  designSpec: string,
  allFiles: string[],
  screenshots?: ScreenshotInput[]
): Promise<string> {
  const screenshotNote =
    screenshots && screenshots.length > 0
      ? `\n\n## Existing UI Screenshots\nThe user provided ${screenshots.length} screenshot(s) of their existing UI. Match the visual style, component patterns, and conventions shown.`
      : "";

  const userContent = [
    `Generate the content for: ${filePath}`,
    "",
    `Other files in this feature: ${allFiles.join(", ")}`,
    "",
    `## PRD\n\n${prd}`,
    "",
    `## Design spec\n\n${designSpec}${screenshotNote}`,
  ].join("\n");

  const raw = await chatWithImages(
    [
      { role: "system", content: FILE_CONTENT_PROMPT },
      { role: "user", content: userContent },
    ],
    screenshots ?? []
  );

  let content = raw.trim();
  content = content.replace(/^```(?:tsx?|jsx?|typescript|javascript|css|json)?\s*\n?/i, "");
  content = content.replace(/\n?\s*```\s*$/i, "");
  return content;
}

/**
 * Modify an existing source file based on the PRD.
 */
async function getModifiedContent(
  filePath: string,
  originalContent: string,
  prd: string,
  designSpec: string,
  allFiles: string[],
  screenshots?: ScreenshotInput[]
): Promise<string> {
  const screenshotNote =
    screenshots && screenshots.length > 0
      ? `\n\n## Existing UI Screenshots\nThe user provided ${screenshots.length} screenshot(s) of their existing UI. Match the visual style, component patterns, and conventions shown in those screenshots while applying the requested changes.`
      : "";

  const userContent = [
    `Modify the file: ${filePath}`,
    "",
    `All files in this project: ${allFiles.join(", ")}`,
    "",
    `## Original file content\n\n\`\`\`\n${originalContent}\n\`\`\``,
    "",
    `## PRD (changes to implement)\n\n${prd}`,
    "",
    `## Design spec\n\n${designSpec}${screenshotNote}`,
  ].join("\n");

  const raw = await chatWithImages(
    [
      { role: "system", content: FILE_MODIFY_PROMPT },
      { role: "user", content: userContent },
    ],
    screenshots ?? []
  );

  let content = raw.trim();
  content = content.replace(/^```(?:tsx?|jsx?|typescript|javascript|css|json)?\s*\n?/i, "");
  content = content.replace(/\n?\s*```\s*$/i, "");
  return content;
}

/**
 * Ask the model if any new files are needed alongside the modified ones.
 */
async function getNewFilesForModify(
  prd: string,
  designSpec: string,
  existingPaths: string[]
): Promise<string[]> {
  const userContent = [
    `## PRD\n\n${prd}`,
    "",
    `## Design spec\n\n${designSpec}`,
    "",
    `## Existing source files being modified\n\n${existingPaths.join(", ")}`,
  ].join("\n");

  const raw = await chat(
    [
      { role: "system", content: NEW_FILES_FOR_MODIFY_PROMPT },
      { role: "user", content: userContent },
    ],
    { jsonMode: true }
  );

  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

  const parsed = JSON.parse(cleaned) as { files?: string[] };
  if (!Array.isArray(parsed.files)) return [];
  return parsed.files
    .filter((f) => typeof f === "string" && f.trim().length > 0)
    .filter((f) => !existingPaths.includes(f));
}

/**
 * Main: generate new code or modify existing source files.
 */
export async function generateCode(
  prd: string,
  designSpec: string,
  sourceFiles?: { path: string; content: string }[],
  screenshots?: ScreenshotInput[]
): Promise<GeneratedFile[]> {
  // --- Modify-existing-code pathway ---
  if (sourceFiles && sourceFiles.length > 0) {
    const existingPaths = sourceFiles.map((f) => f.path);
    const files: GeneratedFile[] = [];

    // Modify each source file
    for (const sf of sourceFiles.slice(0, 6)) {
      try {
        console.log(`[generateCode] Modifying ${sf.path}…`);
        const content = await getModifiedContent(
          sf.path,
          sf.content,
          prd,
          designSpec,
          existingPaths,
          screenshots
        );
        if (content.length > 0) {
          files.push({ path: sf.path, content, isModified: true });
        }
      } catch (err) {
        console.error(
          `[generateCode] Failed to modify ${sf.path}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // Check if any new files are needed
    try {
      console.log("[generateCode] Checking for new files needed…");
      const newPaths = await getNewFilesForModify(prd, designSpec, existingPaths);
      for (const fp of newPaths.slice(0, 2)) {
        try {
          console.log(`[generateCode] Generating new file ${fp}…`);
          const content = await getFileContent(fp, prd, designSpec, [
            ...existingPaths,
            ...newPaths,
          ], screenshots);
          if (content.length > 0) {
            files.push({ path: fp, content, isModified: false });
          }
        } catch (err) {
          console.error(
            `[generateCode] Failed to generate ${fp}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    } catch (err) {
      console.error("[generateCode] New file check failed:", err instanceof Error ? err.message : err);
    }

    return files;
  }

  // --- Generate-new-code pathway (original) ---
  let filePaths: string[];
  try {
    filePaths = await getFileList(prd, designSpec);
  } catch (err) {
    console.error("[generateCode] getFileList failed, using default file paths:", err instanceof Error ? err.message : err);
    filePaths = ["app/page.tsx", "components/Feature.tsx"];
  }

  if (filePaths.length === 0) {
    filePaths = ["app/page.tsx", "components/Feature.tsx"];
  }

  const limited = filePaths.slice(0, 6);
  const files: GeneratedFile[] = [];
  for (const fp of limited) {
    try {
      console.log(`[generateCode] Generating ${fp}…`);
      const content = await getFileContent(fp, prd, designSpec, limited, screenshots);
      if (content.length > 0) {
        files.push({ path: fp, content });
      }
    } catch (err) {
      console.error(`[generateCode] Failed to generate ${fp}:`, err instanceof Error ? err.message : err);
    }
  }

  return files;
}
