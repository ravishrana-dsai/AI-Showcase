// Simple HTTP server: serves local PNG files AND accepts base64 POST saves
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 9099;
const SCREENSHOTS_DIR = "/Users/ravishrana/Desktop/PRD-to-Feature-screenshots";

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204); res.end(); return;
  }

  // GET /file/<filename> — serve a PNG from the screenshots dir
  if (req.method === "GET" && req.url.startsWith("/file/")) {
    const filename = decodeURIComponent(req.url.slice(6));
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      res.writeHead(404); res.end("Not found"); return;
    }
    const data = fs.readFileSync(filepath);
    res.setHeader("Content-Type", "image/png");
    res.writeHead(200);
    res.end(data);
    return;
  }

  // POST /save — save a base64 PNG sent from the browser
  if (req.method === "POST" && req.url === "/save") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { filename, data } = JSON.parse(body);
        const base64 = data.replace(/^data:image\/\w+;base64,/, "");
        const filepath = path.join(SCREENSHOTS_DIR, filename);
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
        fs.writeFileSync(filepath, Buffer.from(base64, "base64"));
        console.log("Saved:", filepath);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, path: filepath }));
      } catch (e) {
        res.writeHead(500); res.end(String(e));
      }
    });
    return;
  }

  res.writeHead(200); res.end("save-server OK");
});

server.listen(PORT, () => console.log(`save-server running on http://localhost:${PORT}`));
