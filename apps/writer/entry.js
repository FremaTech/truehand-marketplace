#!/usr/bin/env node
/**
 * Scrittore — CLI agente.
 *
 * Legge/scrive lo STESSO storage delle API Next (src/lib/writer/store.ts):
 *   ~/.agentic-os/apps/writer/data/docs/<id>.json   (+ index.json)
 * così UI (/writer) e agenti vedono sempre gli stessi documenti.
 *
 * Sottocomandi (output JSON su stdout):
 *   list                  → { docs: [{id,title,updatedAt,words}] }
 *   read <id>             → { id,title,html,updatedAt }
 *   create <title>        → { id }
 *   append <id> <text>    → { ok, id, words }   (accoda HTML o testo in coda)
 *   --help | help         → uso
 */
"use strict";
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const fs = require("node:fs");

const HOME = process.env.HOME || os.homedir();
// Rispetta l'env standard AOS se iniettato, altrimenti default canonico.
const DATA = process.env.AOS_APP_DATA || path.join(HOME, ".agentic-os", "apps", "writer", "data");
const DOCS_DIR = path.join(DATA, "docs");

function ensureDir() { fs.mkdirSync(DOCS_DIR, { recursive: true }); }
function out(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }
function die(msg, code = 1) { process.stdout.write(JSON.stringify({ error: msg }) + "\n"); process.exit(code); }

function safeId(id) { return String(id || "").replace(/[^a-zA-Z0-9_-]/g, ""); }
function docPath(id) { return path.join(DOCS_DIR, `${safeId(id)}.json`); }

function countWords(html) {
  const text = String(html || "")
    .replace(/<br\s*\/?>(?=)/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(" ").filter(Boolean).length : 0;
}

function readDoc(id) {
  const p = docPath(id);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}
function writeDoc(doc) { fs.writeFileSync(docPath(doc.id), JSON.stringify(doc, null, 2)); }

function rebuildIndex() {
  ensureDir();
  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith(".json") && f !== "index.json");
  const summaries = [];
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, f), "utf8"));
      if (d && d.id) summaries.push({ id: d.id, title: d.title || "Senza titolo", updatedAt: d.updatedAt, words: countWords(d.html) });
    } catch { /* skip */ }
  }
  summaries.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  try { fs.writeFileSync(path.join(DOCS_DIR, "index.json"), JSON.stringify(summaries, null, 2)); } catch { /* ignore */ }
  return summaries;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const HELP = `Scrittore CLI — word processor di Agentic OS
Uso: writer <comando> [argomenti]

Comandi:
  list                     elenca i documenti (id, titolo, data, parole)
  read <id>                stampa contenuto del documento (id,title,html,updatedAt)
  create <titolo>          crea un documento vuoto, ritorna {id}
  append <id> <testo>      accoda testo (HTML o plain) al documento
  --help | help            mostra questo aiuto

Esempi (via POST /api/apps/writer/run):
  {"args":["list"]}
  {"args":["create","Lettera al cliente"]}
  {"args":["append","<id>","<p>Gentile cliente,</p>"]}
  {"args":["read","<id>"]}`;

function main() {
  const argv = process.argv.slice(2);
  const cmd = (argv[0] || "").toLowerCase();

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") { console.log(HELP); return; }
  ensureDir();

  switch (cmd) {
    case "list": {
      out({ docs: rebuildIndex() });
      return;
    }
    case "read": {
      const id = argv[1];
      if (!id) die("manca <id>");
      const d = readDoc(id);
      if (!d) die("documento non trovato: " + id);
      out({ id: d.id, title: d.title, html: d.html, updatedAt: d.updatedAt });
      return;
    }
    case "create": {
      const title = argv.slice(1).join(" ").trim() || "Senza titolo";
      const now = new Date().toISOString();
      const doc = { id: crypto.randomUUID(), title, html: "<p><br></p>", createdAt: now, updatedAt: now };
      writeDoc(doc);
      rebuildIndex();
      out({ id: doc.id });
      return;
    }
    case "append": {
      const id = argv[1];
      const text = argv.slice(2).join(" ");
      if (!id) die("manca <id>");
      if (!text) die("manca <text>");
      const doc = readDoc(id);
      if (!doc) die("documento non trovato: " + id);
      // se non sembra HTML, avvolgi in <p> con escaping
      const looksHtml = /<[a-z][\s\S]*>/i.test(text);
      const fragment = looksHtml ? text : `<p>${escapeHtml(text)}</p>`;
      doc.html = (doc.html || "").replace(/^\s*<p><br><\/p>\s*$/i, "") + fragment;
      doc.updatedAt = new Date().toISOString();
      writeDoc(doc);
      rebuildIndex();
      out({ ok: true, id: doc.id, words: countWords(doc.html) });
      return;
    }
    default:
      die("comando sconosciuto: " + cmd + " — usa --help");
  }
}

main();
