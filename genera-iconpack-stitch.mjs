// Genera l'iconpack "stitch": 28 SVG componendo squircle + glifo Material
// Symbols (weight 200, come nel design Stitch) + punto oro.
import fs from "node:fs";

const APPS = [
  ["chat", "chat"], ["mail", "mail"], ["calendar", "calendar_month"],
  ["tasks", "checklist"], ["drive", "folder"], ["apps", "add_box"],
  ["updates", "sync"], ["settings", "settings"], ["themes", "palette"],
  ["terminal", "terminal"], ["notes", "sticky_note_2"], ["kanban", "view_kanban"],
  ["project-manager", "timeline"], ["scheduler", "schedule"], ["deep-research", "search"],
  ["academy", "school"], ["memory", "psychology"], ["companion", "devices"],
  ["browser", "language"], ["workflow", "hub"], ["image-studio", "image"],
  ["icon-studio", "draw"], ["writer", "edit"], ["calculator", "calculate"],
  ["git", "account_tree"], ["automations", "bolt"], ["widgets", "widgets"],
  ["agents", "groups"],
];

const DIR = "iconpacks/stitch";
fs.mkdirSync(DIR, { recursive: true });

let fatte = 0;
for (const [slug, glifo] of APPS) {
  const url = `https://cdn.jsdelivr.net/npm/@material-symbols/svg-200@0.14.5/outlined/${glifo}.svg`;
  const r = await fetch(url);
  if (!r.ok) { console.log("MANCA", glifo, r.status); continue; }
  const src = await r.text();
  const path = (src.match(/<path[^>]*d="([^"]+)"/) || [])[1];
  if (!path) { console.log("NO PATH", glifo); continue; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect x="2" y="2" width="92" height="92" rx="24" fill="#f9f9fd" stroke="#e2e2e6" stroke-width="2"/>
  <g transform="translate(20,76) scale(0.058333)"><path d="${path}" fill="#4d44e3"/></g>
  <circle cx="78" cy="18" r="5" fill="#e9c177"/>
</svg>\n`;
  fs.writeFileSync(`${DIR}/${slug}.svg`, svg);
  fatte++;
}

fs.writeFileSync(`${DIR}/iconpack.json`, JSON.stringify({
  id: "stitch-icons",
  name: "Stitch Icons",
  version: "1.0.0",
  author: "FremaTech",
  description: "Il set di icone del tema Stitch: squircle chiari, glifi indaco peso 200, punto oro. 28 icone per le app di serie.",
  style: "squircle chiaro, indaco #4d44e3, accento oro",
  icons: Object.fromEntries(APPS.map(([s]) => [s, `${s}.svg`])),
}, null, 2) + "\n");

console.log("iconpack:", fatte, "icone");
