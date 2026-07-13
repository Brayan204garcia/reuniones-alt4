import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distClient = path.join(root, "dist", "client");
const distServer = path.join(root, "dist", "server");
const pagesOut = path.join(root, "cloudflare-pages");

if (!fs.existsSync(path.join(distServer, "index.js"))) {
  throw new Error("Missing dist/server/index.js. Run npm run build first.");
}

fs.rmSync(pagesOut, { recursive: true, force: true });
fs.mkdirSync(pagesOut, { recursive: true });
fs.cpSync(distClient, pagesOut, { recursive: true });

for (const entry of fs.readdirSync(distServer)) {
  if (entry === "wrangler.json") continue;

  const source = path.join(distServer, entry);
  const target = path.join(pagesOut, entry === "index.js" ? "_worker.js" : entry);
  fs.cpSync(source, target, { recursive: true });
}

fs.writeFileSync(
  path.join(pagesOut, "_routes.json"),
  `${JSON.stringify({ version: 1, include: ["/*"], exclude: ["/assets/*"] }, null, 2)}\n`,
);

console.log(`Cloudflare Pages output ready: ${pagesOut}`);
