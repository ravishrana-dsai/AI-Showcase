import JSZip from "jszip";

export function downloadZip(
  design: string,
  files: { path: string; content: string }[]
): void {
  const zip = new JSZip();
  zip.file("design.md", design);
  for (const { path, content } of files) {
    zip.file(path, content);
  }
  zip.generateAsync({ type: "blob" }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prd-feature.zip";
    a.click();
    URL.revokeObjectURL(url);
  });
}
