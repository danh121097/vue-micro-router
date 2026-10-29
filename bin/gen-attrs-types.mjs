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
 *   npx vue-micro-router-gen --manifest         # also write micro-router.manifest.json
 *   npx vue-micro-router-gen --help
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  watch as fsWatch
} from 'fs';
import { resolve, relative, dirname, join, extname } from 'path';

const CWD = process.cwd();
const MODULE_NAME = 'vue-micro-router';

// ── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let outputFile = '';
let scanDir = '';
let watchMode = false;
let manifestFile = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' || args[i] === '--output') outputFile = args[++i];
  else if (args[i] === '-m' || args[i] === '--manifest') {
    // Optional value: `--manifest` alone uses the default name
    const next = args[i + 1];
    manifestFile =
      next && !next.startsWith('-') ? args[++i] : 'micro-router.manifest.json';
  }
  else if (args[i] === '-d' || args[i] === '--dir') scanDir = args[++i];
  else if (args[i] === '-w' || args[i] === '--watch') watchMode = true;
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
vue-micro-router-gen — Auto-generate typed augmentations

Usage: npx vue-micro-router-gen [options]

Options:
  -o, --output <file>   Output file (auto: src/vue-micro-router.d.ts or ./vue-micro-router.d.ts)
  -d, --dir <dir>       Directory to scan (auto-detects src/, app/, or cwd)
  -m, --manifest [file] Also write a JSON manifest of every route, dialog and
                        control with its literal \`meta\` and source file
                        (default: micro-router.manifest.json)
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
    if (existsSync(resolve(CWD, dir))) {
      scanDir = dir;
      break;
    }
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
if (manifestFile) console.log(`Manifest: ${manifestFile}`);

// ── Walk ────────────────────────────────────────────────────────────────────

const SKIP = new Set([
  'node_modules',
  'dist',
  '.git',
  '.nuxt',
  '.next',
  '.output',
  '.vite'
]);

function walk(dir, exts) {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walk(full, exts));
      else if (entry.isFile() && exts.includes(extname(entry.name)))
        results.push(full);
    }
  } catch {
    /* skip */
  }
  return results;
}

// ── Alias resolution ────────────────────────────────────────────────────────

/** Try to resolve tsconfig/vite path aliases like @/, ~/, #/ */
function resolveAlias(importPath) {
  // Common alias patterns
  const aliasPrefixes = ['@/', '~/', '#/'];
  const prefix = aliasPrefixes.find((p) => importPath.startsWith(p));
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
  let depth = 1,
    i = pos;
  while (i < str.length && depth > 0) {
    // A bracket inside a string or comment is not one
    const skipped = skipStringOrComment(str, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
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
    const skipped = skipStringOrComment(str, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    if (str[i] === '{') {
      let d = 1,
        s = i;
      i++;
      while (i < str.length && d > 0) {
        // Braces inside strings and comments do not end the entry
        const inner = skipStringOrComment(str, i);
        if (inner !== i) {
          i = inner;
          continue;
        }
        if (str[i] === '{') d++;
        else if (str[i] === '}') d--;
        i++;
      }
      blocks.push(str.substring(s, i));
    } else i++;
  }
  return blocks;
}

// ── Literal meta ────────────────────────────────────────────────────────────

/** Skip a quoted string starting at `i` (the quote); returns the index after it. */
function skipString(str, i) {
  const quote = str[i++];
  while (i < str.length && str[i] !== quote) i += str[i] === '\\' ? 2 : 1;
  return i + 1;
}

/**
 * Index after the string or comment that starts at `i`, or `i` when none does.
 * Comments are skipped like strings, so a `// don't` never opens a quote.
 */
function skipStringOrComment(str, i) {
  const ch = str[i];
  if (ch === '"' || ch === "'" || ch === '`') return skipString(str, i);
  if (str.startsWith('//', i)) {
    const end = str.indexOf('\n', i);
    return end === -1 ? str.length : end;
  }
  if (str.startsWith('/*', i)) {
    const end = str.indexOf('*/', i + 2);
    return end === -1 ? str.length : end + 2;
  }
  return i;
}

/**
 * Source text of the `meta` value of an entry block, at the block's own top
 * level (not a `meta` nested in attrs). `undefined` when the entry has none.
 */
function findMetaSource(block) {
  let depth = 0;
  for (let i = 0; i < block.length; i++) {
    const skipped = skipStringOrComment(block, i);
    if (skipped !== i) {
      i = skipped - 1;
      continue;
    }
    const ch = block[i];
    if ('{[('.includes(ch)) depth++;
    else if ('}])'.includes(ch)) depth--;
    if (depth !== 1 || !block.startsWith('meta', i)) continue;
    if (/[\w$]/.test(block[i - 1] ?? '')) continue;
    const key = block.slice(i).match(/^meta\s*:\s*/);
    // Shorthand `{ meta }` or a method `meta() {}`: present, but not a literal
    if (!key) {
      if (/^meta\s*([,}(]|$)/.test(block.slice(i))) return 'meta';
      continue;
    }
    const start = i + key[0].length;
    // Balanced value up to the next top-level `,` or the entry's closing `}`
    let d = 0;
    for (let j = start; j < block.length; j++) {
      const skippedValue = skipStringOrComment(block, j);
      if (skippedValue !== j) {
        j = skippedValue - 1;
        continue;
      }
      const c = block[j];
      if ('{[('.includes(c)) d++;
      else if ('}])'.includes(c)) {
        if (d === 0) return block.slice(start, j).trim();
        d--;
      } else if (c === ',' && d === 0) return block.slice(start, j).trim();
    }
    return block.slice(start).trim();
  }
  return undefined;
}

const SIMPLE_ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };

/**
 * JS string escapes decoded as the engine would; `null` for one it cannot
 * decode (`\u{zz}`, `\x4`), so the caller treats the meta as non-literal
 * instead of writing a mangled value.
 */
function decodeEscapes(body) {
  let bad = false;
  const decoded = body.replace(
    /\\(u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|[ux]|\r\n|[\s\S])/g,
    (whole, esc, braced, u4, x2) => {
      const hex = braced ?? u4 ?? x2;
      if (hex !== undefined) {
        const code = parseInt(hex, 16);
        if (code > 0x10ffff) bad = true;
        return bad ? '' : String.fromCodePoint(code);
      }
      if (esc === 'u' || esc === 'x') bad = true;
      // A backslash before a line break continues the string
      if (esc === '\n' || esc === '\r\n' || esc === '\r') return '';
      return SIMPLE_ESCAPES[esc] ?? esc;
    }
  );
  return bad ? null : decoded;
}

/**
 * Parse a JS literal — objects, arrays, strings, numbers, booleans, null —
 * without evaluating anything. Throws on any other expression.
 */
function parseLiteral(src) {
  let i = 0;
  const fail = () => {
    throw new Error(`not a literal at ${i}`);
  };
  const ws = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith('//', i)) i = src.indexOf('\n', i) === -1 ? src.length : src.indexOf('\n', i);
      else if (src.startsWith('/*', i)) i = src.indexOf('*/', i) + 2 || fail();
      else return;
    }
  };
  const string = () => {
    const quote = src[i];
    const end = skipString(src, i);
    const body = src.slice(i + 1, end - 1);
    if (quote === '`' && body.includes('${')) fail();
    i = end;
    return decodeEscapes(body) ?? fail();
  };
  const value = () => {
    ws();
    const ch = src[i];
    if (ch === '{') {
      i++;
      const obj = {};
      for (;;) {
        ws();
        if (src[i] === '}') { i++; return obj; }
        let key;
        if (src[i] === '"' || src[i] === "'") key = string();
        else {
          const m = src.slice(i).match(/^[A-Za-z_$][\w$]*|^\d+/);
          if (!m) fail();
          key = m[0];
          i += key.length;
        }
        ws();
        if (src[i++] !== ':') fail();
        obj[key] = value();
        ws();
        if (src[i] === ',') i++;
        else if (src[i] !== '}') fail();
      }
    }
    if (ch === '[') {
      i++;
      const arr = [];
      for (;;) {
        ws();
        if (src[i] === ']') { i++; return arr; }
        arr.push(value());
        ws();
        if (src[i] === ',') i++;
        else if (src[i] !== ']') fail();
      }
    }
    if (ch === '"' || ch === "'" || ch === '`') return string();
    const m = src.slice(i).match(/^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)(?![\w$])/);
    if (!m) fail();
    i += m[0].length;
    return JSON.parse(m[0]);
  };
  const result = value();
  ws();
  if (src.slice(i).replace(/^as\s+const/, '').trim()) fail();
  return result;
}

// ── Plugin extraction ───────────────────────────────────────────────────────

function findPlugins() {
  const plugins = [];
  for (const file of walk(SCAN_PATH, ['.ts'])) {
    const content = readFileSync(file, 'utf-8');
    if (!content.includes('defineFeaturePlugin(')) continue;
    const match = content.match(
      /export\s+const\s+(\w+)\s*=\s*defineFeaturePlugin\(/
    );
    if (match)
      plugins.push({
        absPath: file,
        relPath: relative(CWD, file),
        exportName: match[1]
      });
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
    { kind: 'control', regex: /controls\s*:\s*\[/g }
  ];

  for (const { kind, regex } of sections) {
    let m;
    while ((m = regex.exec(content)) !== null) {
      const arrayContent = extractBracketContent(
        content,
        m.index + m[0].length
      );
      for (const block of extractEntryBlocks(arrayContent)) {
        const keyField = kind === 'control' ? 'name' : 'path';
        const keyMatch = block.match(
          new RegExp(`${keyField}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`)
        );
        if (!keyMatch) continue;

        let componentFile = null;
        const impMatch = block.match(
          /component\s*:\s*\(\)\s*=>\s*import\(\s*['"`]([^'"`]+)['"`]\s*\)/
        );
        const varMatch = block.match(/component\s*:\s*(\w+)/);

        if (impMatch) {
          componentFile = resolveComponent(dir, impMatch[1]);
        } else if (varMatch && !['true', 'false'].includes(varMatch[1])) {
          const importRegex = new RegExp(
            `import\\s+${varMatch[1]}\\s+from\\s+['"\`]([^'"\`]+)['"\`]`
          );
          const imp = content.match(importRegex);
          if (imp) componentFile = resolveComponent(dir, imp[1]);
        }

        entries.push({
          kind,
          key: keyMatch[1],
          componentFile,
          source: relative(CWD, filePath),
          metaSource: findMetaSource(block)
        });
      }
    }
  }
  return entries;
}

function hasAttrs(filePath) {
  try {
    return /export\s+interface\s+Attrs\b/.test(
      readFileSync(resolve(CWD, filePath), 'utf-8')
    );
  } catch {
    return false;
  }
}

// ── Manifest ────────────────────────────────────────────────────────────────

/** Write `content` only when it changed — prevents unnecessary HMR/reload triggers */
function writeIfChanged(file, content) {
  const outPath = resolve(CWD, file);
  let existing = '';
  try {
    existing = readFileSync(outPath, 'utf-8');
  } catch {
    // File doesn't exist yet — first run
  }
  if (existing === content) {
    console.log(`✅ ${file} (unchanged)`);
    return;
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content);
  console.log(`✅ ${file}`);
}

/**
 * Every route, dialog and control with its source file and `meta`, sorted by
 * name so the file only changes when a definition does. `meta` is read as a
 * literal; anything else (a variable, a call, a template string with
 * `${}`) is written as `null` with a warning.
 */
function writeManifest(entries) {
  const toPosix = (p) => p.replace(/\\/g, '/');
  const sections = { route: [], dialog: [], control: [] };
  for (const e of entries) {
    const item = {
      [e.kind === 'control' ? 'name' : 'path']: e.key,
      source: toPosix(e.source),
      component: e.componentFile ? toPosix(e.componentFile) : null
    };
    if (e.metaSource !== undefined) {
      try {
        item.meta = parseLiteral(e.metaSource);
      } catch {
        console.warn(
          `⚠️  ${e.source}: ${e.kind} '${e.key}' meta is not a literal — written as null`
        );
        item.meta = null;
      }
    }
    sections[e.kind].push(item);
  }
  const byKey = (a, b) => {
    const ka = a.path ?? a.name;
    const kb = b.path ?? b.name;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
  const manifest = {
    version: 1,
    routes: sections.route.sort(byKey),
    dialogs: sections.dialog.sort(byKey),
    controls: sections.control.sort(byKey)
  };
  writeIfChanged(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
}

// ── Generate ────────────────────────────────────────────────────────────────

function generate() {
  const plugins = findPlugins();
  if (plugins.length === 0) {
    console.log('No defineFeaturePlugin() calls found.');
    return false;
  }

  console.log(`Plugins: ${plugins.length}`);
  plugins.forEach((p) => console.log(`  ${p.relPath} → ${p.exportName}`));

  const allEntries = plugins.flatMap((p) => extractEntries(p.absPath));
  if (manifestFile) writeManifest(allEntries);

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
  console.log(
    `Dialogs: ${typed.dialog.length} typed / ${untyped.dialog} untyped`
  );
  console.log(
    `Controls: ${typed.control.length} typed / ${untyped.control} untyped`
  );

  const outDir = dirname(resolve(CWD, outputFile));
  const lines = [
    '/* Auto-generated by vue-micro-router-gen. DO NOT EDIT. */',
    '/* Regenerate: npx vue-micro-router-gen */',
    ''
  ];

  for (const p of plugins) {
    const rel = relative(outDir, resolve(CWD, p.relPath)).replace(/\\/g, '/');
    const imp = rel.startsWith('.') ? rel : `./${rel}`;
    lines.push(
      `import type { ${p.exportName} } from '${imp.replace(/\.ts$/, '')}';`
    );
  }

  for (const [kind, entries] of Object.entries(typed)) {
    for (const e of entries) {
      const alias = `${kind}_${e.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const rel = relative(outDir, resolve(CWD, e.componentFile)).replace(
        /\\/g,
        '/'
      );
      const imp = rel.startsWith('.') ? rel : `./${rel}`;
      lines.push(`import type { Attrs as ${alias} } from '${imp}';`);
    }
  }

  lines.push('');
  lines.push(`declare module '${MODULE_NAME}' {`);

  if (plugins.length > 0) {
    lines.push('  interface Register {');
    lines.push(
      `    plugin: ${plugins.map((p) => `typeof ${p.exportName}`).join(' | ')};`
    );
    lines.push('  }');
  }

  for (const [mapName, kind] of [
    ['RouteAttrsMap', 'route'],
    ['DialogAttrsMap', 'dialog'],
    ['ControlAttrsMap', 'control']
  ]) {
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
  writeIfChanged(outputFile, lines.join('\n'));
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
      console.log(
        `\n[${new Date().toLocaleTimeString()}] Change detected, regenerating...`
      );
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
