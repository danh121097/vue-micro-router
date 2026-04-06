#!/usr/bin/env bun
/**
 * Auto-generate vue-micro-router.d.ts with ALL type augmentations:
 * - Register.plugin from plugin files (auto-detected)
 * - RouteAttrsMap from components that export `interface Attrs`
 * - DialogAttrsMap from dialog components that export `interface Attrs`
 * - ControlAttrsMap from control components that export `interface Attrs`
 *
 * Convention:
 * - Plugin files: any *plugin*.ts file
 * - Components: export `interface Attrs { ... }` for typed attrs
 *
 * Usage: bun run gen:types
 * Output: vue-micro-router.d.ts (include in tsconfig)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, relative, dirname } from 'path';

const CWD = process.cwd();
const OUTPUT_FILE = process.argv[2] || 'vue-micro-router.d.ts';

/**
 * Detect module path: for local dev use relative path to libs/index,
 * for npm consumers use 'vue-micro-router'.
 */
function detectModulePath(pluginFiles: string[]): string {
  for (const file of pluginFiles) {
    const content = readFileSync(resolve(CWD, file), 'utf-8');
    // Check if imports from relative path (local dev) or package name (npm)
    const importMatch = content.match(/from\s+['"`]([^'"`]*(?:vue-micro-router|libs\/index)[^'"`]*)['"`]/);
    if (importMatch) {
      const raw = importMatch[1];
      if (raw.includes('vue-micro-router')) return 'vue-micro-router';
      // Relative path — resolve from OUTPUT_FILE location
      const absPath = resolve(CWD, dirname(file), raw);
      let relPath = relative(dirname(resolve(CWD, OUTPUT_FILE)), absPath).replace(/\\/g, '/');
      if (!relPath.startsWith('.')) relPath = `./${relPath}`;
      return relPath;
    }
  }
  return 'vue-micro-router';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface PluginEntry {
  kind: 'route' | 'dialog' | 'control';
  key: string;
  componentFile: string | null;
}

interface PluginFile {
  path: string;
  exportName: string;
}

function findFiles(patterns: string[]): string[] {
  const files: string[] = [];
  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for (const match of glob.scanSync({ cwd: CWD })) {
      if (!match.includes('node_modules')) files.push(match);
    }
  }
  return [...new Set(files)];
}

/** Find the exported plugin variable name */
function findPluginExport(filePath: string): string | null {
  const content = readFileSync(resolve(CWD, filePath), 'utf-8');
  const match = content.match(/export\s+const\s+(\w+)\s*=\s*defineFeaturePlugin\(/);
  return match ? match[1] : null;
}

function extractPluginEntries(filePath: string): PluginEntry[] {
  const content = readFileSync(resolve(CWD, filePath), 'utf-8');
  const entries: PluginEntry[] = [];
  const dir = dirname(filePath);

  const routeRegex = /{\s*path:\s*['"`]([^'"`]+)['"`]\s*,\s*component:\s*(?:(\w+)|.*?import\(['"`]([^'"`]+)['"`]\))/g;
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const [, path, componentVar, importPath] = match;
    let componentFile: string | null = null;

    if (importPath) {
      componentFile = resolveComponentPath(dir, importPath);
    } else if (componentVar) {
      const importRegex = new RegExp(`import\\s+${componentVar}\\s+from\\s+['"\`]([^'"\`]+)['"\`]`);
      const importMatch = content.match(importRegex);
      if (importMatch) {
        componentFile = resolveComponentPath(dir, importMatch[1]);
      }
    }

    const beforeMatch = content.substring(0, match.index);
    const isDialog = /dialogs\s*:\s*\[(?:[^\]]*,)*\s*$/.test(beforeMatch);
    entries.push({ kind: isDialog ? 'dialog' : 'route', key: path, componentFile });
  }

  const controlRegex = /{\s*name:\s*['"`]([^'"`]+)['"`]\s*,\s*component:\s*(?:(\w+)|.*?import\(['"`]([^'"`]+)['"`]\))/g;
  while ((match = controlRegex.exec(content)) !== null) {
    const [, name, componentVar, importPath] = match;
    let componentFile: string | null = null;

    if (importPath) {
      componentFile = resolveComponentPath(dir, importPath);
    } else if (componentVar) {
      const importRegex = new RegExp(`import\\s+${componentVar}\\s+from\\s+['"\`]([^'"\`]+)['"\`]`);
      const importMatch = content.match(importRegex);
      if (importMatch) {
        componentFile = resolveComponentPath(dir, importMatch[1]);
      }
    }

    entries.push({ kind: 'control', key: name, componentFile });
  }

  return entries;
}

function resolveComponentPath(fromDir: string, importPath: string): string | null {
  const extensions = ['', '.vue', '.ts', '.tsx', '.js', '.jsx'];
  for (const ext of extensions) {
    const fullPath = resolve(CWD, fromDir, importPath + ext);
    if (existsSync(fullPath)) return relative(CWD, fullPath);
  }
  return null;
}

function hasExportedAttrs(filePath: string): boolean {
  try {
    const content = readFileSync(resolve(CWD, filePath), 'utf-8');
    return /export\s+interface\s+Attrs\b/.test(content);
  } catch {
    return false;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
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

  const MODULE_PATH = detectModulePath(pluginFiles);
  console.log(`  Module: '${MODULE_PATH}'`);

  // Find plugin exports for Register
  const plugins: PluginFile[] = [];
  for (const file of pluginFiles) {
    const exportName = findPluginExport(file);
    if (exportName) plugins.push({ path: file, exportName });
  }

  // Extract all entries
  const allEntries: PluginEntry[] = [];
  for (const file of pluginFiles) {
    allEntries.push(...extractPluginEntries(file));
  }

  // Filter entries with components that export Attrs
  const routeAttrs: { key: string; file: string }[] = [];
  const dialogAttrs: { key: string; file: string }[] = [];
  const controlAttrs: { key: string; file: string }[] = [];

  for (const entry of allEntries) {
    if (!entry.componentFile || !hasExportedAttrs(entry.componentFile)) continue;
    const target =
      entry.kind === 'route' ? routeAttrs :
      entry.kind === 'dialog' ? dialogAttrs : controlAttrs;
    target.push({ key: entry.key, file: entry.componentFile });
  }

  // ── Generate output ───────────────────────────────────────────────────────
  const outputDir = dirname(resolve(CWD, OUTPUT_FILE));
  const lines: string[] = [
    '/* Auto-generated by gen-attrs-types. DO NOT EDIT. */',
    '/* Run: bun run gen:types */',
    '',
  ];

  // Import plugin types
  for (const plugin of plugins) {
    const relPath = relative(outputDir, resolve(CWD, plugin.path)).replace(/\\/g, '/');
    const importPath = relPath.startsWith('.') ? relPath : `./${relPath}`;
    // Remove .ts extension for import
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
  lines.push(`declare module '${MODULE_PATH}' {`);

  // Register — plugin type
  if (plugins.length > 0) {
    const pluginUnion = plugins.map((p) => `typeof ${p.exportName}`).join(' | ');
    lines.push('  interface Register {');
    lines.push(`    plugin: ${pluginUnion};`);
    lines.push('  }');
  }

  // RouteAttrsMap
  if (routeAttrs.length > 0) {
    lines.push('  interface RouteAttrsMap {');
    for (const entry of routeAttrs) {
      const alias = `route_${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
      lines.push(`    ${entry.key}: ${alias};`);
    }
    lines.push('  }');
  }

  // DialogAttrsMap
  if (dialogAttrs.length > 0) {
    lines.push('  interface DialogAttrsMap {');
    for (const entry of dialogAttrs) {
      const alias = `dialog_${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
      lines.push(`    ${entry.key}: ${alias};`);
    }
    lines.push('  }');
  }

  // ControlAttrsMap
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
}

main();
