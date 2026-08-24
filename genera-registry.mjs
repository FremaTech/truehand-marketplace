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

// Temi: un tema e' un singolo JSON di token del motore UI.
if (fs.existsSync("themes")) {
  for (const f of fs.readdirSync("themes").filter((x) => x.endsWith(".json"))) {
    const t = JSON.parse(fs.readFileSync(`themes/${f}`, "utf8"));
    reg.apps.push({
      id: t.id,
      type: "theme",
      name: t.name,
      version: t.version || "1.0.0",
      author: t.author || "FremaTech",
      category: "themes",
      description: t.description || "",
      source: "https://github.com/FremaTech/truehand-marketplace",
      install_method: "download-json",
      theme_url: `https://raw.githubusercontent.com/FremaTech/truehand-marketplace/main/themes/${f}`,
      tags: ["theme", t.light ? "light" : "dark"],
    });
  }
}

fs.writeFileSync("registry.json", JSON.stringify(reg, null, 2) + "\n");
console.log("registry:", reg.apps.length, "voci (app + temi)");
