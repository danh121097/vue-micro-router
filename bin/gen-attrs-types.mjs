#!/usr/bin/env node
/**
 * Auto-generate vue-micro-router.d.ts with ALL type augmentations.
 *
 * Convention:
 * - Plugin files: any *plugin*.ts file
 * - Components: export `interface Attrs { ... }` for typed attrs
 *
 * Usage: npx vue-micro-router-gen
 *        npx vue-micro-router-gen [output-file]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, relative, dirname, join } from 'path';

const CWD = process.cwd();
const OUTPUT_FILE = process.argv[2] || 'vue-micro-router.d.ts';
const MODULE_NAME = 'vue-micro-router';

// ── Glob replacement (Node-compatible) ─────────────────────────────────────

function walkDir(dir, patterns) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      if (entry.isDirectory()) {
        results.push(...walkDir(fullPath, patterns));
      } else if (entry.isFile()) {
        const relPath = relative(CWD, fullPath);
        if (patterns.some(p => matchPattern(relPath, p))) {
          results.push(relPath);
        }
      }
    }
  } catch { /* skip inaccessible dirs */ }
  return results;
}

function matchPattern(filePath, pattern) {
  // Simple glob: *plugin*.ts matches files containing "plugin" ending with .ts
  const regex = pattern
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*/g, '[^/]*')
    .replace(/\./g, '\\.');
  return new RegExp(`^${regex}$`).test(filePath);
}

function findFiles(patterns) {
  return [...new Set(walkDir(CWD, patterns))];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function findPluginExport(filePath) {
  const content = readFileSync(resolve(CWD, filePath), 'utf-8');
  const match = content.match(/export\s+const\s+(\w+)\s*=\s*defineFeaturePlugin\(/);
  return match ? match[1] : null;
}

function extractPluginEntries(filePath) {
  const content = readFileSync(resolve(CWD, filePath), 'utf-8');
  const entries = [];
  const dir = dirname(filePath);

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

const PLUGIN_PATTERNS = [
  'src/**/*plugin*.ts',
  'examples/**/*plugin*.ts',
  'app/**/*plugin*.ts',
  'plugins/**/*.ts',
  '*plugin*.ts',
];

const pluginFiles = findFiles(PLUGIN_PATTERNS);
if (pluginFiles.length === 0) {
  console.log('No plugin files found. Searched:', PLUGIN_PATTERNS);
  process.exit(0);
}

console.log(`Found ${pluginFiles.length} plugin file(s):`);
pluginFiles.forEach((f) => console.log(`  ${f}`));

// Find plugin exports for Register
const plugins = [];
for (const file of pluginFiles) {
  const exportName = findPluginExport(file);
  if (exportName) plugins.push({ path: file, exportName });
}

// Extract all entries
const allEntries = [];
for (const file of pluginFiles) {
  allEntries.push(...extractPluginEntries(file));
}

// Filter entries with components that export Attrs
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

// ── Generate output ───────────────────────────────────────────────────────
const outputDir = dirname(resolve(CWD, OUTPUT_FILE));
const lines = [
  '/* Auto-generated by vue-micro-router-gen. DO NOT EDIT. */',
  `/* Run: npx vue-micro-router-gen */`,
  '',
];

// Import plugin types
for (const plugin of plugins) {
  const relPath = relative(outputDir, resolve(CWD, plugin.path)).replace(/\\/g, '/');
  const importPath = relPath.startsWith('.') ? relPath : `./${relPath}`;
  const cleanPath = importPath.replace(/\.ts$/, '');
  lines.push(`import type { ${plugin.exportName} } from '${cleanPath}';`);
}

// Import Attrs types from components
const mapEntries = { route: routeAttrs, dialog: dialogAttrs, control: controlAttrs };
for (const [kind, entries] of Object.entries(mapEntries)) {
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
  const pluginUnion = plugins.map((p) => `typeof ${p.exportName}`).join(' | ');
  lines.push('  interface Register {');
  lines.push(`    plugin: ${pluginUnion};`);
  lines.push('  }');
}

if (routeAttrs.length > 0) {
  lines.push('  interface RouteAttrsMap {');
  for (const entry of routeAttrs) {
    const alias = `route_${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
    lines.push(`    ${entry.key}: ${alias};`);
  }
  lines.push('  }');
}

if (dialogAttrs.length > 0) {
  lines.push('  interface DialogAttrsMap {');
  for (const entry of dialogAttrs) {
    const alias = `dialog_${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
    lines.push(`    ${entry.key}: ${alias};`);
  }
  lines.push('  }');
}

if (controlAttrs.length > 0) {
  lines.push('  interface ControlAttrsMap {');
  for (const entry of controlAttrs) {
    const alias = `control_${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
    lines.push(`    ${entry.key}: ${alias};`);
  }
  lines.push('  }');
}

lines.push('}', '');

writeFileSync(resolve(CWD, OUTPUT_FILE), lines.join('\n'));
console.log(`\n✅ Generated ${OUTPUT_FILE}`);
console.log(`   Plugins: ${plugins.length}, Routes: ${routeAttrs.length}, Dialogs: ${dialogAttrs.length}, Controls: ${controlAttrs.length}`);
