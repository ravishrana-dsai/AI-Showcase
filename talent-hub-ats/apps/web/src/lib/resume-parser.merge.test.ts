import { describe, it, expect } from "vitest";
import { mergePdfTextSources } from "./resume-parser";

describe("mergePdfTextSources", () => {
  it("returns OCR side when unpdf empty", () => {
    expect(mergePdfTextSources("", "Only OCR")).toBe("Only OCR");
  });

  it("returns unpdf when OCR empty", () => {
    expect(mergePdfTextSources("Only Text", "")).toBe("Only Text");
  });

  it("dedupes identical lines and preserves order (unpdf first)", () => {
    const merged = mergePdfTextSources("Jane Doe\njane@x.com", "Jane Doe\n+1 555");
    expect(merged).toBe("Jane Doe\njane@x.com\n+1 555");
  });

  it("normalizes case for dedupe keys", () => {
    const merged = mergePdfTextSources("Jane Doe", "jane doe\nExtra");
    expect(merged).toBe("Jane Doe\nExtra");
  });
});
