import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  extractText: vi.fn(),
  pdf: vi.fn(),
  createWorker: vi.fn(),
}));

vi.mock("unpdf", () => ({
  extractText: mocks.extractText,
}));

vi.mock("pdf-to-img", () => ({
  pdf: mocks.pdf,
}));

vi.mock("tesseract.js", () => ({
  createWorker: mocks.createWorker,
}));

import { parseResume } from "./resume-parser";

describe("parseResume (application/pdf) + OCR policy", () => {
  beforeEach(() => {
    delete process.env.RESUME_PDF_OCR;
    mocks.extractText.mockReset();
    mocks.pdf.mockReset();
    mocks.createWorker.mockReset();

    mocks.pdf.mockImplementation(async () => ({
      async *[Symbol.asyncIterator]() {
        yield Buffer.from("fake-png-page");
      },
    }));

    mocks.createWorker.mockResolvedValue({
      recognize: vi.fn().mockResolvedValue({ data: { text: "OCR Only Line\nocr@found.test" } }),
      terminate: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    delete process.env.RESUME_PDF_OCR;
  });

  it("runs OCR when text extraction is short (mandatory) even if skipPdfOcr is true", async () => {
    mocks.extractText.mockResolvedValue({ text: ["hi"] });

    const parsed = await parseResume(Buffer.from("%PDF-1.4 fake"), "application/pdf", {
      skipPdfOcr: true,
    });

    expect(mocks.createWorker).toHaveBeenCalled();
    expect(parsed.rawText.toLowerCase()).toContain("ocr");
    expect(parsed.email).toBe("ocr@found.test");
  });

  it("skips optional OCR when text is long but junk and skipPdfOcr is true", async () => {
    const junk = "@".repeat(200);
    mocks.extractText.mockResolvedValue({ text: [junk] });

    await parseResume(Buffer.from("%PDF-1.4 fake"), "application/pdf", {
      skipPdfOcr: true,
    });

    expect(mocks.createWorker).not.toHaveBeenCalled();
  });

  it("runs optional OCR for long junk text when skipPdfOcr is false", async () => {
    const junk = "@".repeat(200);
    mocks.extractText.mockResolvedValue({ text: [junk] });

    await parseResume(Buffer.from("%PDF-1.4 fake"), "application/pdf", {
      skipPdfOcr: false,
    });

    expect(mocks.createWorker).toHaveBeenCalled();
  });

  it("never runs OCR when RESUME_PDF_OCR is 0", async () => {
    process.env.RESUME_PDF_OCR = "0";
    mocks.extractText.mockResolvedValue({ text: [""] });

    await expect(
      parseResume(Buffer.from("%PDF-1.4 fake"), "application/pdf")
    ).rejects.toThrow();

    expect(mocks.createWorker).not.toHaveBeenCalled();
  });
});
