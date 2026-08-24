#!/usr/bin/env node
/**
 * AOS Editor (Monaco) — Test suite v2
 * Tests entry.js engine commands via CLI
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENTRY = path.join(__dirname, 'entry.js');
const DATA_DIR = path.join(__dirname, 'data');
const TEST_WS = path.join(DATA_DIR, '_test_');

function run(cmd, args = [], ws) {
  const env = { ...process.env };
  if (ws) env.AOS_EDITOR_WORKSPACE = ws;
  const argStr = [cmd, ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
  try {
    const result = execSync(`node "${ENTRY}" ${argStr}`, {
      encoding: 'utf8',
      timeout: 10000,
      env,
      cwd: __dirname
    });
    return JSON.parse(result.trim());
  } catch (e) {
    try { return JSON.parse(e.stdout?.trim() || '{}'); } catch { return { ok: false, error: e.message }; }
  }
}

function cleanTestDir() {
  if (fs.existsSync(TEST_WS)) {
    try { fs.rmSync(TEST_WS, { recursive: true, force: true }); } catch {}
  }
  fs.mkdirSync(TEST_WS, { recursive: true });
}

console.log('\n=== AOS Editor Test Suite v2 ===\n');

// ─── Setup ─────────────────────────────────────────────────
cleanTestDir();

// ─── 1. Unknown command ────────────────────────────────────
console.log('1. Unknown command');
{
  const r = run('bogus');
  assert.strictEqual(r.ok, false, 'unknown cmd should fail');
  console.log('  ✓ unknown command returns ok:false');
}

// ─── 2. Info ────────────────────────────────────────────────
console.log('2. Info');
{
  const r = run('info');
  assert.strictEqual(r.ok, true);
  assert.ok(r.commands.length > 0, 'info should list commands');
  console.log('  ✓ info returns commands list');
}

// ─── 3. Save + Load ────────────────────────────────────────
console.log('3. Save + Load');
{
  const r = run('save', ['test.txt', 'hello world'], TEST_WS);
  assert.strictEqual(r.ok, true, 'save should succeed: ' + JSON.stringify(r));
  const r2 = run('load', ['test.txt'], TEST_WS);
  assert.strictEqual(r2.ok, true, 'load should succeed: ' + JSON.stringify(r2));
  assert.strictEqual(r2.content, 'hello world', 'content matches');
  console.log('  ✓ save + load roundtrip');
}

// ─── 4. Save in subdirectory ──────────────────────────────
console.log('4. Save in subdirectory');
{
  run('mkdir', ['subdir'], TEST_WS);
  const r = run('save', ['subdir/nested.txt', 'nested content'], TEST_WS);
  assert.strictEqual(r.ok, true, 'save in subdir: ' + JSON.stringify(r));
  const r2 = run('load', ['subdir/nested.txt'], TEST_WS);
  assert.strictEqual(r2.content, 'nested content', 'nested content matches');
  console.log('  ✓ save + load in subdirectory');
}

// ─── 5. List ────────────────────────────────────────────────
console.log('5. List');
{
  const r = run('list', [], TEST_WS);
  assert.strictEqual(r.ok, true);
  assert.ok(Array.isArray(r.files), 'list should return files array');
  console.log('  ✓ list returns files array');
}

// ─── 6. Stat ────────────────────────────────────────────────
console.log('6. Stat');
{
  const r = run('stat', ['test.txt'], TEST_WS);
  assert.strictEqual(r.ok, true, 'stat should succeed: ' + JSON.stringify(r));
  assert.ok(r.size !== undefined, 'stat should have size');
  console.log('  ✓ stat returns file info');
}

// ─── 7. Search ─────────────────────────────────────────────
console.log('7. Search');
{
  const r = run('search', ['test'], TEST_WS);
  assert.strictEqual(r.ok, true);
  assert.ok(r.results.length > 0, 'search should find test.txt');
  console.log('  ✓ search finds files');
}

// ─── 8. Delete ──────────────────────────────────────────────
console.log('8. Delete');
{
  const r = run('delete', ['test.txt'], TEST_WS);
  assert.strictEqual(r.ok, true, 'delete should succeed: ' + JSON.stringify(r));
  const r2 = run('load', ['test.txt'], TEST_WS);
  assert.strictEqual(r2.ok, false, 'deleted file should not load');
  console.log('  ✓ delete + verify absent');
}

// ─── 9. Workspace management ────────────────────────────────
console.log('9. Workspace management');
{
  const r = run('workspace', ['add', 'testproj']);
  assert.strictEqual(r.ok, true, 'workspace add should succeed: ' + JSON.stringify(r));
  assert.ok(r.dir, 'workspace should have dir');
  const r2 = run('workspace', ['testproj']);
  assert.strictEqual(r2.ok, true, 'workspace lookup should succeed');
  assert.strictEqual(r2.name, 'testproj', 'workspace name matches');
  console.log('  ✓ workspace add + lookup');
}

// ─── 10. Set workdir ──────────────────────────────────────
console.log('10. Set workdir');
{
  // Create a new workspace
  const ws = run('workspace', ['add', 'ws-setworkdir']);
  assert.strictEqual(ws.ok, true, 'workspace add should succeed');
  // Set workdir to the new workspace path
  const r = run('set-workdir', [ws.dir]);
  assert.strictEqual(r.ok, true, 'set-workdir should succeed: ' + JSON.stringify(r));
  assert.ok(r.workdir, 'set-workdir should return workdir');
  console.log('  ✓ set-workdir sets workdir successfully');
  // Verify workdir is persisted
  const r2 = run('workspace', ['default']);
  assert.strictEqual(r2.ok, true, 'workspace default should succeed');
  console.log('  ✓ workspace default still works after set-workdir');
}

// ─── Cleanup ────────────────────────────────────────────────
cleanTestDir();
console.log('\n=== All tests passed! ===\n');
