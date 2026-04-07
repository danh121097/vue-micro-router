#!/usr/bin/env node
/**
 * Auto-generate vue-micro-router.d.ts with ALL type augmentations.
 *
 * Scans ALL .ts files in the project for `defineFeaturePlugin(` calls,
 * then finds components with `export interface Attrs` for typed props.
 *
 * Usage:
 *   npx vue-micro-router-gen                    # scan cwd, output vue-micro-router.d.ts
 *   npx vue-micro-router-gen -o types.d.ts      # custom output file
 *   npx vue-micro-router-gen -d src/plugins     # scan specific directory
 *   npx vue-micro-router-gen --help
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, relative, dirname, join, extname } from 'path';

const CWD = process.cwd();
const MODULE_NAME = 'vue-micro-router';

// ── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let OUTPUT_FILE = 'vue-micro-router.d.ts';
let SCAN_DIR = CWD;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' || args[i] === '--output') OUTPUT_FILE = args[++i];
  else if (args[i] === '-d' || args[i] === '--dir') SCAN_DIR = resolve(CWD, args[++i]);
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
vue-micro-router-gen — Auto-generate typed augmentations

Usage: npx vue-micro-router-gen [options]

Options:
  -o, --output <file>   Output file (default: vue-micro-router.d.ts)
  -d, --dir <dir>       Directory to scan (default: cwd)
  -h, --help            Show this help

How it works:
  1. Scans all .ts files for \`defineFeaturePlugin(\` calls
  2. Extracts routes/dialogs/controls from plugin definitions
  3. Checks if component files export \`interface Attrs { ... }\`
  4. Generates vue-micro-router.d.ts with Register + AttrsMap augmentations

Convention:
  - Components that want typed push() props: \`export interface Attrs { ... }\`
  - Required fields = must pass in push(). Optional fields = can skip.
`);
    process.exit(0);
  }
}

// ── Walk & scan ─────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.nuxt', '.next', '.output']);

function walkTs(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkTs(fullPath));
      } else if (entry.isFile() && extname(entry.name) === '.ts') {
        results.push(fullPath);
      }
    }
  } catch { /* skip inaccessible */ }
  return results;
}

/** Find all .ts files that call defineFeaturePlugin */
function findPluginFiles() {
  const tsFiles = walkTs(SCAN_DIR);
  const plugins = [];
  for (const file of tsFiles) {
    const content = readFileSync(file, 'utf-8');
    if (content.includes('defineFeaturePlugin(')) {
      const match = content.match(/export\s+const\s+(\w+)\s*=\s*defineFeaturePlugin\(/);
      if (match) {
        plugins.push({ absPath: file, relPath: relative(CWD, file), exportName: match[1] });
      }
    }
  }
  return plugins;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractPluginEntries(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const entries = [];
  const dir = dirname(relative(CWD, filePath));

  const routeRegex = /{\s*path:\s*['"`]([^'"`]+)['"`]\s*,\s*component:\s*(?:(\w+)|.*?import\(['"`]([^'"`]+)['"`]\))/g;
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const [, path, componentVar, importPath] = match;
    let componentFile = null;

    if (importPath) {
      componentFile = resolveComponentPath(dir, importPath);
    } else if (componentVar) {
      const importRegex = new RegExp(`import\\s+${componentVar}\\s+from\\s+['"\`]([^'"\`]+)['"\`]`);
      const importMatch = content.match(importRegex);
      if (importMatch) componentFile = resolveComponentPath(dir, importMatch[1]);
    }

    const beforeMatch = content.substring(0, match.index);
    const isDialog = /dialogs\s*:\s*\[(?:[^\]]*,)*\s*$/.test(beforeMatch);
    entries.push({ kind: isDialog ? 'dialog' : 'route', key: path, componentFile });
  }

  const controlRegex = /{\s*name:\s*['"`]([^'"`]+)['"`]\s*,\s*component:\s*(?:(\w+)|.*?import\(['"`]([^'"`]+)['"`]\))/g;
  while ((match = controlRegex.exec(content)) !== null) {
    const [, name, componentVar, importPath] = match;
    let componentFile = null;

    if (importPath) {
      componentFile = resolveComponentPath(dir, importPath);
    } else if (componentVar) {
      const importRegex = new RegExp(`import\\s+${componentVar}\\s+from\\s+['"\`]([^'"\`]+)['"\`]`);
      const importMatch = content.match(importRegex);
      if (importMatch) componentFile = resolveComponentPath(dir, importMatch[1]);
    }

    entries.push({ kind: 'control', key: name, componentFile });
  }

  return entries;
}

function resolveComponentPath(fromDir, importPath) {
  const extensions = ['', '.vue', '.ts', '.tsx', '.js', '.jsx'];
  for (const ext of extensions) {
    const fullPath = resolve(CWD, fromDir, importPath + ext);
    if (existsSync(fullPath)) return relative(CWD, fullPath);
  }
  return null;
}

function hasExportedAttrs(filePath) {
  try {
    const content = readFileSync(resolve(CWD, filePath), 'utf-8');
    return /export\s+interface\s+Attrs\b/.test(content);
  } catch {
    return false;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

const plugins = findPluginFiles();
if (plugins.length === 0) {
  console.log('No files with defineFeaturePlugin() found.');
  console.log(`Scanned: ${relative(CWD, SCAN_DIR) || '.'}`);
  console.log('Tip: use -d <dir> to specify scan directory');
  process.exit(0);
}

console.log(`Found ${plugins.length} plugin(s):`);
plugins.forEach((p) => console.log(`  ${p.relPath} → ${p.exportName}`));

// Extract entries
const allEntries = [];
for (const plugin of plugins) {
  allEntries.push(...extractPluginEntries(plugin.absPath));
}

const routeAttrs = [];
const dialogAttrs = [];
const controlAttrs = [];

for (const entry of allEntries) {
  if (!entry.componentFile || !hasExportedAttrs(entry.componentFile)) continue;
  const target =
    entry.kind === 'route' ? routeAttrs :
    entry.kind === 'dialog' ? dialogAttrs : controlAttrs;
  target.push({ key: entry.key, file: entry.componentFile });
}

// ── Generate ────────────────────────────────────────────────────────────────

const outputDir = dirname(resolve(CWD, OUTPUT_FILE));
const lines = [
  '/* Auto-generated by vue-micro-router-gen. DO NOT EDIT. */',
  '/* Run: npx vue-micro-router-gen */',
  '',
];

for (const plugin of plugins) {
  const relPath = relative(outputDir, resolve(CWD, plugin.relPath)).replace(/\\/g, '/');
  const importPath = relPath.startsWith('.') ? relPath : `./${relPath}`;
  lines.push(`import type { ${plugin.exportName} } from '${importPath.replace(/\.ts$/, '')}';`);
}

for (const [kind, entries] of Object.entries({ route: routeAttrs, dialog: dialogAttrs, control: controlAttrs })) {
  for (const entry of entries) {
    const alias = `${kind}_${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const relPath = relative(outputDir, resolve(CWD, entry.file)).replace(/\\/g, '/');
    const importPath = relPath.startsWith('.') ? relPath : `./${relPath}`;
    lines.push(`import type { Attrs as ${alias} } from '${importPath}';`);
  }
}

lines.push('');
lines.push(`declare module '${MODULE_NAME}' {`);

if (plugins.length > 0) {
  lines.push('  interface Register {');
  lines.push(`    plugin: ${plugins.map((p) => `typeof ${p.exportName}`).join(' | ')};`);
  lines.push('  }');
}

for (const [mapName, entries] of [['RouteAttrsMap', routeAttrs], ['DialogAttrsMap', dialogAttrs], ['ControlAttrsMap', controlAttrs]]) {
  if (entries.length > 0) {
    lines.push(`  interface ${mapName} {`);
    for (const entry of entries) {
      const kind = mapName.replace('AttrsMap', '').toLowerCase();
      const alias = `${kind}_${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
      lines.push(`    ${entry.key}: ${alias};`);
    }
    lines.push('  }');
  }
}

lines.push('}', '');
writeFileSync(resolve(CWD, OUTPUT_FILE), lines.join('\n'));
console.log(`\n✅ Generated ${OUTPUT_FILE}`);
console.log(`   Plugins: ${plugins.length}, Routes: ${routeAttrs.length}, Dialogs: ${dialogAttrs.length}, Controls: ${controlAttrs.length}`);
