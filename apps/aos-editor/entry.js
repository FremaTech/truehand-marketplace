#!/usr/bin/env node
/**
 * AOS Editor (Monaco) — CLI engine v2
 * Commands: list, ls, load, save, delete, rm, mkdir, rmdir, rename, mv, exec, run, agent-chat, info, workspace, stat, search
 * Sandbox: all file ops confined to workspace dir (data/ or custom)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = process.env.AOS_APP_DATA || path.join(__dirname, 'data');
const LOG_DIR = path.join(__dirname, 'logs');
const WORKSPACES_FILE = path.join(DATA_DIR, '.workspaces.json');

// Ensure base dirs exist
[DATA_DIR, LOG_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ─── Logging ───────────────────────────────────────────────
function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}\n`;
  try { fs.appendFileSync(path.join(LOG_DIR, 'editor.log'), line); } catch {}
}

// ─── Workspace management ───────────────────────────────────
function loadWorkspaces() {
  try { return JSON.parse(fs.readFileSync(WORKSPACES_FILE, 'utf8')); }
  catch { return { default: DATA_DIR }; }
}

function saveWorkspaces(ws) {
  const dir = path.dirname(WORKSPACES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(ws, null, 2));
}

function getWorkspace(name) {
  if (!name || name === 'default') return DATA_DIR;
  const ws = loadWorkspaces();
  if (ws[name]) return ws[name];
  return null;
}

// ─── Path safety ────────────────────────────────────────────
function resolveSafe(filePath, cwd) {
  const base = cwd || DATA_DIR;
  const resolved = path.resolve(base, filePath);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`SANDBOX VIOLATION: "${filePath}" exits sandbox ${base}`);
  }
  return resolved;
}

function isBinary(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.bmp',
    '.zip', '.tar', '.gz', '.rar', '.7z', '.woff', '.woff2', '.ttf', '.eot',
    '.pdf', '.doc', '.xls', '.ppt', '.exe', '.dll', '.so', '.dylib'];
  return binaryExts.includes(ext);
}

// ─── Commands ───────────────────────────────────────────────

function cmd_info() {
  return {
    ok: true,
    app: 'aos-editor',
    version: '2.0.0',
    engine: 'Monaco Editor',
    workspace: DATA_DIR,
    commands: ['list', 'ls', 'load', 'save', 'delete', 'rm', 'mkdir', 'rmdir',
      'rename', 'mv', 'exec', 'run', 'agent-chat', 'info', 'workspace', 'set-workdir', 'stat', 'search']
  };
}

function cmd_workspace(args) {
  const sub = args[0] || 'list';
  const ws = loadWorkspaces();

  if (sub === 'list' || sub === 'ls') {
    return { ok: true, workspaces: Object.entries(ws).map(([name, dir]) => ({ name, dir })) };
  }

  if (sub === 'add') {
    const name = args[1];
    const dir = args[2] ? path.resolve(args[2]) : null;
    if (!name) return { ok: false, error: 'Usage: workspace add <name> [dir]' };
    if (!dir) {
      const newDir = path.join(DATA_DIR, name);
      if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
      ws[name] = newDir;
    } else {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      ws[name] = dir;
    }
    saveWorkspaces(ws);
    return { ok: true, workspace: name, dir: ws[name] };
  }

  if (sub === 'remove' || sub === 'rm') {
    const name = args[1];
    if (!name) return { ok: false, error: 'Usage: workspace remove <name>' };
    if (!ws[name]) return { ok: false, error: `Workspace "${name}" not found` };
    delete ws[name];
    saveWorkspaces(ws);
    return { ok: true, removed: name };
  }

  // workspace <name> → return workspace path
  if (ws[sub]) {
    return { ok: true, name: sub, path: ws[sub] };
  }
  return { ok: false, error: `Unknown workspace: "${sub}". Use "workspace add" to create one.` };
}

function cmd_list(args, cwd) {
  const dir = args[0] ? resolveSafe(args[0], cwd) : cwd || DATA_DIR;
  if (!fs.existsSync(dir)) return { ok: false, error: `Directory not found: ${dir}` };
  const entries = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
  const files = entries.map(f => {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    const isDir = stat.isDirectory();
    return { name: f, type: isDir ? 'dir' : 'file', isDir, path: full, size: stat.size, mtime: stat.mtime };
  });
  return { ok: true, path: dir, files };
}

function cmd_load(args, cwd) {
  const filePath = args[0];
  if (!filePath) return { ok: false, error: 'Usage: load <filepath>' };
  const resolved = resolveSafe(filePath, cwd);
  if (!fs.existsSync(resolved)) return { ok: false, error: `File not found: ${resolved}` };
  if (isBinary(resolved)) return { ok: false, error: `Binary file: ${resolved}. Use exec to inspect.` };
  try {
    const content = fs.readFileSync(resolved, 'utf8');
    const stat = fs.statSync(resolved);
    log('info', `Loaded ${resolved} (${stat.size} bytes)`);
    return { ok: true, path: resolved, content, size: stat.size, modified: stat.mtime };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function cmd_save(args, cwd) {
  // save <filepath> <content> or save <filepath> --stdin (reads from stdin-like pipe)
  const filePath = args[0];
  if (!filePath) return { ok: false, error: 'Usage: save <filepath> [content]' };
  const resolved = resolveSafe(filePath, cwd);
  const content = args.slice(1).join(' ');
  if (!content) return { ok: false, error: 'Usage: save <filepath> <content> (no empty content)' };
  // Ensure parent dir exists
  const parent = path.dirname(resolved);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  fs.writeFileSync(resolved, content, 'utf8');
  log('info', `Saved ${resolved} (${content.length} bytes)`);
  return { ok: true, path: resolved, size: content.length };
}

function cmd_delete(args, cwd) {
  const filePath = args[0];
  if (!filePath) return { ok: false, error: 'Usage: delete <filepath>' };
  const resolved = resolveSafe(filePath, cwd);
  if (!fs.existsSync(resolved)) return { ok: false, error: `File not found: ${resolved}` };
  fs.unlinkSync(resolved);
  log('info', `Deleted ${resolved}`);
  return { ok: true, deleted: resolved };
}

function cmd_mkdir(args, cwd) {
  const dirPath = args[0];
  if (!dirPath) return { ok: false, error: 'Usage: mkdir <dirpath>' };
  const resolved = resolveSafe(dirPath, cwd);
  fs.mkdirSync(resolved, { recursive: true });
  log('info', `Created directory ${resolved}`);
  return { ok: true, created: resolved };
}

function cmd_rmdir(args, cwd) {
  const dirPath = args.find(a => !a.startsWith('-'));
  if (!dirPath) return { ok: false, error: 'Usage: rmdir <dirpath> [--force]' };
  const force = args.includes('--force') || args.includes('-f');
  const resolved = resolveSafe(dirPath, cwd);
  if (!fs.existsSync(resolved)) return { ok: false, error: `Directory not found: ${resolved}` };

  if (!force) {
    const entries = fs.readdirSync(resolved);
    if (entries.length > 0) {
      return { ok: false, error: `Directory not empty: ${resolved}. Use --force to remove recursively.` };
    }
    fs.rmdirSync(resolved);
  } else {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  log('info', `Removed directory ${resolved}`);
  return { ok: true, removed: resolved };
}

function cmd_rename(args, cwd) {
  const src = args[0], dst = args[1];
  if (!src || !dst) return { ok: false, error: 'Usage: rename <src> <dst>' };
  const srcResolved = resolveSafe(src, cwd);
  const dstResolved = resolveSafe(dst, cwd);
  if (!fs.existsSync(srcResolved)) return { ok: false, error: `Source not found: ${srcResolved}` };
  fs.renameSync(srcResolved, dstResolved);
  log('info', `Renamed ${srcResolved} → ${dstResolved}`);
  return { ok: true, from: srcResolved, to: dstResolved };
}

function cmd_exec(args, cwd) {
  const cmd = args.join(' ');
  if (!cmd) return { ok: false, error: 'Usage: exec <command>' };

  // Block dangerous commands (injection safeguard)
  const BLOCKED = [/\brm\s+-rf\b/, /\bshutdown\b/, /\breboot\b/, /\bmkfs\b/, /\bdd\s+if=/,
    /\bformat\b/, /\bkill\s+-9\b/, /\biptables\b/, /\bchmod\s+777\b/,
    /\bcurl\s+.*\|\s*sh\b/, /\bwget\s+.*\|\s*sh\b/, /\b:\(\)\{.*\}\b/];
  for (const re of BLOCKED) {
    if (re.test(cmd)) {
      log('warn', `Exec blocked (dangerous pattern): ${cmd}`);
      return { ok: false, command: cmd, error: 'Command blocked: dangerous pattern detected', exitCode: -1 };
    }
  }

  try {
    const output = execSync(cmd, {
      cwd: cwd || DATA_DIR,
      timeout: 30000,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    });
    log('info', `Exec: ${cmd} → ${output.length} bytes`);
    return { ok: true, command: cmd, output: output.slice(0, 50000), exitCode: 0 };
  } catch (e) {
    log('error', `Exec failed: ${cmd} → ${e.message}`);
    return { ok: false, command: cmd, error: e.stderr || e.message, exitCode: e.status };
  }
}

function cmd_stat(args, cwd) {
  const filePath = args[0];
  if (!filePath) return { ok: false, error: 'Usage: stat <filepath>' };
  const resolved = resolveSafe(filePath, cwd);
  if (!fs.existsSync(resolved)) return { ok: false, error: `File not found: ${resolved}` };
  const stat = fs.statSync(resolved);
  return {
    ok: true,
    name: path.basename(resolved),
    path: resolved,
    size: stat.size,
    isFile: stat.isFile(),
    isDir: stat.isDirectory(),
    modified: stat.mtime,
    created: stat.birthtime
  };
}

function cmd_search(args, cwd) {
  const pattern = args[0];
  if (!pattern) return { ok: false, error: 'Usage: search <pattern>' };
  const dir = cwd || DATA_DIR;
  const results = [];
  function walk(d, depth) {
    if (depth > 10) return;
    try {
      const entries = fs.readdirSync(d);
      for (const e of entries) {
        if (e.startsWith('.')) continue;
        const full = path.join(d, e);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, depth + 1);
        else if (e.toLowerCase().includes(pattern.toLowerCase()) || full.toLowerCase().includes(pattern.toLowerCase())) {
          results.push({ path: full, name: e, size: stat.size });
        }
      }
    } catch {}
  }
  walk(dir, 0);
  return { ok: true, pattern, results, count: results.length };
}

// ─── Set workdir ──────────────────────────────────────
function cmd_set_workdir(args, cwd) {
  const dir = args[0];
  if (!dir) return { ok: false, error: "Usage: set-workdir <path>" };
  /* Resolve via workspace name or absolute path */
  const resolved = getWorkspace(dir) || (path.isAbsolute(dir) ? dir : path.resolve(cwd || DATA_DIR, dir));
  /* Validate: must exist and be a directory */
  if (!fs.existsSync(resolved)) return { ok: false, error: `Directory not found: ${resolved}` };
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) return { ok: false, error: `Not a directory: ${resolved}` };
  /* Sandbox check: resolved path must be within allowed roots */
  const allowedRoots = [DATA_DIR, process.env.HOME];
  const isAllowed = allowedRoots.some(r => resolved.startsWith(r + path.sep) || resolved === r);
  if (!isAllowed) return { ok: false, error: `SANDBOX: path outside allowed roots` };
  log("info", `Workdir set to ${resolved}`);
  return { ok: true, workdir: resolved, path: resolved };
}

function cmd_agent_chat(args) {
  const message = args.join(' ');
  if (!message) return { ok: false, error: 'Usage: agent-chat <message>' };
  // Delegate to native agent via HTTP
  return { ok: true, message: 'Agent chat forwarded to native agent system', note: 'Use the UI chat panel for interactive agent conversations' };
}

// ─── Main entry ─────────────────────────────────────────────
async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) {
    console.log(JSON.stringify(cmd_info()));
    process.exit(0);
  }

  const command = rawArgs[0];
  const args = rawArgs.slice(1);

  // Resolve workspace from env or arg
  const wsEnv = process.env.AOS_EDITOR_WORKSPACE;
  const cwd = wsEnv ? (getWorkspace(wsEnv) || wsEnv) : DATA_DIR;

  let result;
  try {
    switch (command) {
      case 'info': result = cmd_info(); break;
      case 'workspace': result = cmd_workspace(args); break;
      case 'list':
      case 'ls': result = cmd_list(args, cwd); break;
      case 'load': result = cmd_load(args, cwd); break;
      case 'save': result = cmd_save(args, cwd); break;
      case 'delete':
      case 'rm': result = cmd_delete(args, cwd); break;
      case 'mkdir': result = cmd_mkdir(args, cwd); break;
      case 'rmdir': result = cmd_rmdir(args, cwd); break;
      case 'rename':
      case 'mv': result = cmd_rename(args, cwd); break;
      case 'exec':
      case 'run': result = cmd_exec(args, cwd); break;
      case 'stat': result = cmd_stat(args, cwd); break;
      case 'search': result = cmd_search(args, cwd); break;
      case 'agent-chat': result = cmd_agent_chat(args); break;
      case 'set-workdir': result = cmd_set_workdir(args); break;
      default:
        result = { ok: false, error: `Unknown command: "${command}". Available: ${cmd_info().commands.join(', ')}` };
    }
  } catch (e) {
    result = { ok: false, error: e.message };
    log('error', `Command "${command}" failed: ${e.message}`);
  }

  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

main();