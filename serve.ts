// Sunshine City v3 — tiny static server for local play-testing.
// Serves game/ at http://localhost:8080 (no network, no dependencies).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(join(fileURLToPath(import.meta.url), "..", "game"));
const PORT = 8080;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    let path = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const file = resolve(join(root, path));
    if (!file.startsWith(root)) { res.writeHead(403); res.end("forbidden"); return; }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    res.writeHead(404); res.end("not found");
  }
});

server.listen(PORT, () => {
  console.log("Sunshine City v3 at http://localhost:" + PORT);
});
