// Genera registry.json dal contenuto di apps/
import fs from "node:fs";

const apps = fs.readdirSync("apps");
const reg = { version: "1.0", updatedAt: new Date().toISOString(), apps: [] };

for (const id of apps) {
  let m = {};
  try { m = JSON.parse(fs.readFileSync(`apps/${id}/manifest.json`, "utf8")); } catch {}
  reg.apps.push({
    id,
    name: m.name || id,
    version: m.version || "1.0.0",
    author: "FremaTech",
    category: m.category || "tools",
    description: (m.description || "").slice(0, 200),
    source: "https://github.com/FremaTech/truehand-marketplace",
    install_method: "download-tgz",
    tgz_url: `https://raw.githubusercontent.com/FremaTech/truehand-marketplace/main/dist/${id}.tar.gz`,
    tags: m.tags || [],
  });
}

fs.writeFileSync("registry.json", JSON.stringify(reg, null, 2) + "\n");
console.log("registry:", reg.apps.length, "app");
