import puppeteer from "puppeteer";
import { writeFile } from "fs/promises";
import { pathToFileURL } from "url";

/**
 * Export a deck HTML file to PDF using Puppeteer.
 *
 * @param {string} htmlPath   - Absolute path to the deck.html file
 * @param {string} outputPath - Absolute path where deck.pdf will be written
 */
export async function exportPDF(htmlPath, outputPath) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Set viewport to match the fixed slide dimensions
    await page.setViewport({ width: 1280, height: 720 });

    // Load from file:// so relative asset paths resolve correctly
    const fileUrl = pathToFileURL(htmlPath).href;
    await page.goto(fileUrl, { waitUntil: "networkidle0" });

    // Wait for Google Fonts to load (they are loaded via <link>)
    await page.evaluate(() => document.fonts.ready);

    const pdfBuffer = await page.pdf({
      path: outputPath,
      width: "1280px",
      height: "720px",
      printBackground: true,
      scale: 1,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
