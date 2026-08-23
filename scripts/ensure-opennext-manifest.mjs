import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const serverDir = path.join(root, ".next", "server");
const standaloneServerDir = path.join(root, ".next", "standalone", ".next", "server");
const source = path.join(serverDir, "pages-manifest.json");
const target = path.join(standaloneServerDir, "pages-manifest.json");

fs.mkdirSync(standaloneServerDir, { recursive: true });

if (fs.existsSync(source)) {
  fs.copyFileSync(source, target);
  console.log("OpenNext: copied pages-manifest.json into standalone output.");
} else if (!fs.existsSync(target)) {
  // App Router-only projects can legitimately have no Pages Router manifest.
  // OpenNext currently expects this file while collecting static HTML assets.
  fs.writeFileSync(target, "{}\n");
  console.log("OpenNext: created empty pages-manifest.json for App Router-only build.");
}
