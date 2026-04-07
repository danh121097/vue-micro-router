#!/usr/bin/env node
/**
 * vue-micro-router-gen — Auto-generate typed augmentations.
 *
 * Scans project for:
 * 1. .ts files with `defineFeaturePlugin(` → Register.plugin
 * 2. .vue/.ts files with `export interface Attrs` → RouteAttrsMap/DialogAttrsMap/ControlAttrsMap
 *
 * Usage:
 *   npx vue-micro-router-gen                    # auto-detect, output to src/ or project root
 *   npx vue-micro-router-gen -o src/types.d.ts  # custom output
 *   npx vue-micro-router-gen -d src             # scan specific dir
 *   npx vue-micro-router-gen --help
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, watch as fsWatch } from 'fs';
import { resolve, relative, dirname, join, extname } from 'path';

const CWD = process.cwd();
const MODULE_NAME = 'vue-micro-router';

// ── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let outputFile = '';
let scanDir = '';
let watchMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' || args[i] === '--output') outputFile = args[++i];
  else if (args[i] === '-d' || args[i] === '--dir') scanDir = args[++i];
  else if (args[i] === '-w' || args[i] === '--watch') watchMode = true;
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
vue-micro-router-gen — Auto-generate typed augmentations

Usage: npx vue-micro-router-gen [options]

Options:
  -o, --output <file>   Output file (auto: src/vue-micro-router.d.ts or ./vue-micro-router.d.ts)
  -d, --dir <dir>       Directory to scan (auto-detects src/, app/, or cwd)
  -w, --watch           Watch .vue/.ts files and regenerate on change
  -h, --help            Show this help

How it works:
  1. Scans .ts files for defineFeaturePlugin() → auto-registers plugins
  2. Resolves routes/dialogs/controls → finds component files
  3. Checks .vue files for \`export interface Attrs { ... }\`
  4. Generates vue-micro-router.d.ts with all type augmentations

Convention: Components export \`interface Attrs\` for typed push()/openDialog() props.
`);
    process.exit(0);
  }
}

// Auto-detect scan directory
if (!scanDir) {
  for (const dir of ['src', 'app', 'lib']) {
    if (existsSync(resolve(CWD, dir))) { scanDir = dir; break; }
  }
  if (!scanDir) scanDir = '.';
}
const SCAN_PATH = resolve(CWD, scanDir);

// Always output to project root — avoids Vite HMR loop when inside src/
if (!outputFile) {
  outputFile = 'vue-micro-router.d.ts';
}

console.log(`Scan: ${scanDir}/`);
console.log(`Output: ${outputFile}`);

// ── Walk ────────────────────────────────────────────────────────────────────

const SKIP = new Set(['node_modules', 'dist', '.git', '.nuxt', '.next', '.output', '.vite']);

function walk(dir, exts) {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walk(full, exts));
      else if (entry.isFile() && exts.includes(extname(entry.name))) results.push(full);
    }
  } catch { /* skip */ }
  return results;
}

// ── Alias resolution ────────────────────────────────────────────────────────

/** Try to resolve tsconfig/vite path aliases like @/, ~/, #/ */
function resolveAlias(importPath) {
  // Common alias patterns
  const aliasPrefixes = ['@/', '~/', '#/'];
  const prefix = aliasPrefixes.find(p => importPath.startsWith(p));
  if (!prefix) return null;

  const stripped = importPath.slice(prefix.length);
  // Try common base directories
  for (const base of ['src', 'app', 'lib', 'libs', '.']) {
    for (const ext of ['', '.vue', '.ts', '.tsx', '.js', '.jsx']) {
      const full = resolve(CWD, base, stripped + ext);
      if (existsSync(full)) return relative(CWD, full);
    }
  }
  return null;
}

function resolveComponent(fromDir, importPath) {
  // Try alias first
  const aliased = resolveAlias(importPath);
  if (aliased) return aliased;

  // Relative path
  for (const ext of ['', '.vue', '.ts', '.tsx', '.js', '.jsx']) {
    const full = resolve(CWD, fromDir, importPath + ext);
    if (existsSync(full)) return relative(CWD, full);
  }
  return null;
}

// ── Bracket-aware parsing ───────────────────────────────────────────────────

function extractBracketContent(str, pos) {
  let depth = 1, i = pos;
  while (i < str.length && depth > 0) {
    if (str[i] === '[') depth++;
    else if (str[i] === ']') depth--;
    i++;
  }
  return str.substring(pos, i - 1);
}

function extractEntryBlocks(str) {
  const blocks = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === '{') {
      let d = 1, s = i; i++;
      while (i < str.length && d > 0) { if (str[i]==='{') d++; else if (str[i]==='}') d--; i++; }
      blocks.push(str.substring(s, i));
    } else i++;
  }
  return blocks;
}

// ── Plugin extraction ───────────────────────────────────────────────────────

function findPlugins() {
  const plugins = [];
  for (const file of walk(SCAN_PATH, ['.ts'])) {
    const content = readFileSync(file, 'utf-8');
    if (!content.includes('defineFeaturePlugin(')) continue;
    const match = content.match(/export\s+const\s+(\w+)\s*=\s*defineFeaturePlugin\(/);
    if (match) plugins.push({ absPath: file, relPath: relative(CWD, file), exportName: match[1] });
  }
  return plugins;
}

function extractEntries(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const entries = [];
  const dir = dirname(relative(CWD, filePath));

  const sections = [
    { kind: 'route', regex: /routes\s*:\s*\[/g },
    { kind: 'dialog', regex: /dialogs\s*:\s*\[/g },
    { kind: 'control', regex: /controls\s*:\s*\[/g },
  ];

  for (const { kind, regex } of sections) {
    let m;
    while ((m = regex.exec(content)) !== null) {
      const arrayContent = extractBracketContent(content, m.index + m[0].length);
      for (const block of extractEntryBlocks(arrayContent)) {
        const keyField = kind === 'control' ? 'name' : 'path';
        const keyMatch = block.match(new RegExp(`${keyField}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`));
        if (!keyMatch) continue;

        let componentFile = null;
        const impMatch = block.match(/component\s*:\s*\(\)\s*=>\s*import\(\s*['"`]([^'"`]+)['"`]\s*\)/);
        const varMatch = block.match(/component\s*:\s*(\w+)/);

        if (impMatch) {
          componentFile = resolveComponent(dir, impMatch[1]);
        } else if (varMatch && !['true', 'false'].includes(varMatch[1])) {
          const importRegex = new RegExp(`import\\s+${varMatch[1]}\\s+from\\s+['"\`]([^'"\`]+)['"\`]`);
          const imp = content.match(importRegex);
          if (imp) componentFile = resolveComponent(dir, imp[1]);
        }

        entries.push({ kind, key: keyMatch[1], componentFile });
      }
    }
  }
  return entries;
}

function hasAttrs(filePath) {
  try {
    return /export\s+interface\s+Attrs\b/.test(readFileSync(resolve(CWD, filePath), 'utf-8'));
  } catch { return false; }
}

// ── Generate ────────────────────────────────────────────────────────────────

function generate() {
  const plugins = findPlugins();
  if (plugins.length === 0) {
    console.log('No defineFeaturePlugin() calls found.');
    return false;
  }

  console.log(`Plugins: ${plugins.length}`);
  plugins.forEach(p => console.log(`  ${p.relPath} → ${p.exportName}`));

  const allEntries = plugins.flatMap(p => extractEntries(p.absPath));

  const typed = { route: [], dialog: [], control: [] };
  const untyped = { route: 0, dialog: 0, control: 0 };

  for (const entry of allEntries) {
    if (entry.componentFile && hasAttrs(entry.componentFile)) {
      typed[entry.kind].push(entry);
    } else {
      untyped[entry.kind]++;
    }
  }

  console.log(`Routes: ${typed.route.length} typed / ${untyped.route} untyped`);
  console.log(`Dialogs: ${typed.dialog.length} typed / ${untyped.dialog} untyped`);
  console.log(`Controls: ${typed.control.length} typed / ${untyped.control} untyped`);

  const outDir = dirname(resolve(CWD, outputFile));
  const lines = [
    '/* Auto-generated by vue-micro-router-gen. DO NOT EDIT. */',
    '/* Regenerate: npx vue-micro-router-gen */',
    '',
  ];

  for (const p of plugins) {
    const rel = relative(outDir, resolve(CWD, p.relPath)).replace(/\\/g, '/');
    const imp = rel.startsWith('.') ? rel : `./${rel}`;
    lines.push(`import type { ${p.exportName} } from '${imp.replace(/\.ts$/, '')}';`);
  }

  for (const [kind, entries] of Object.entries(typed)) {
    for (const e of entries) {
      const alias = `${kind}_${e.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const rel = relative(outDir, resolve(CWD, e.componentFile)).replace(/\\/g, '/');
      const imp = rel.startsWith('.') ? rel : `./${rel}`;
      lines.push(`import type { Attrs as ${alias} } from '${imp}';`);
    }
  }

  lines.push('');
  lines.push(`declare module '${MODULE_NAME}' {`);

  if (plugins.length > 0) {
    lines.push('  interface Register {');
    lines.push(`    plugin: ${plugins.map(p => `typeof ${p.exportName}`).join(' | ')};`);
    lines.push('  }');
  }

  for (const [mapName, kind] of [['RouteAttrsMap', 'route'], ['DialogAttrsMap', 'dialog'], ['ControlAttrsMap', 'control']]) {
    if (typed[kind].length > 0) {
      lines.push(`  interface ${mapName} {`);
      for (const e of typed[kind]) {
        const alias = `${kind}_${e.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
        lines.push(`    '${e.key}': ${alias};`);
      }
      lines.push('  }');
    }
  }

  lines.push('}', '');
  writeFileSync(resolve(CWD, outputFile), lines.join('\n'));
  console.log(`✅ ${outputFile}`);
  return true;
}

// ── Run ─────────────────────────────────────────────────────────────────────

generate();

if (watchMode) {
  console.log(`\n👀 Watching ${scanDir}/ for .vue/.ts changes...\n`);

  let debounce = null;
  const regenerate = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log(`\n[${new Date().toLocaleTimeString()}] Change detected, regenerating...`);
      generate();
    }, 300);
  };

  fsWatch(SCAN_PATH, { recursive: true }, (event, filename) => {
    if (!filename) return;
    // Skip .d.ts files (output file, auto-imports.d.ts, etc.) — only watch source
    if (filename.endsWith('.d.ts')) return;
    if (filename.endsWith('.vue') || filename.endsWith('.ts')) regenerate();
  });
}
