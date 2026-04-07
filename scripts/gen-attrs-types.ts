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

/** Extract top-level { ... } blocks from array content — bracket-aware */
function extractEntryBlocks(str: string): string[] {
  const blocks: string[] = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === '{') {
      let depth = 1;
      const start = i;
      i++;
      while (i < str.length && depth > 0) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') depth--;
        i++;
      }
      blocks.push(str.substring(start, i));
    } else {
      i++;
    }
  }
  return blocks;
}

/** Extract content between matching brackets starting at pos (after opening bracket) */
function extractBracketContent(str: string, pos: number): string {
  let depth = 1;
  let i = pos;
  while (i < str.length && depth > 0) {
    if (str[i] === '[') depth++;
    else if (str[i] === ']') depth--;
    i++;
  }
  return str.substring(pos, i - 1);
}

function extractPluginEntries(filePath: string): PluginEntry[] {
  const content = readFileSync(resolve(CWD, filePath), 'utf-8');
  const entries: PluginEntry[] = [];
  const dir = dirname(filePath);

  const sections: { kind: PluginEntry['kind']; regex: RegExp }[] = [
    { kind: 'route', regex: /routes\s*:\s*\[/g },
    { kind: 'dialog', regex: /dialogs\s*:\s*\[/g },
    { kind: 'control', regex: /controls\s*:\s*\[/g },
  ];

  for (const section of sections) {
    let sectionMatch;
    while ((sectionMatch = section.regex.exec(content)) !== null) {
      const start = sectionMatch.index + sectionMatch[0].length;
      const arrayContent = extractBracketContent(content, start);

      const entryBlocks = extractEntryBlocks(arrayContent);
      for (const block of entryBlocks) {
        const keyField = section.kind === 'control' ? 'name' : 'path';
        const keyMatch = block.match(new RegExp(`${keyField}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`));
        if (!keyMatch) continue;

        const key = keyMatch[1];
        let componentFile: string | null = null;

        const importMatch = block.match(/component\s*:\s*\(\)\s*=>\s*import\(\s*['"`]([^'"`]+)['"`]\s*\)/);
        const varMatch = block.match(/component\s*:\s*(\w+)/);

        if (importMatch) {
          componentFile = resolveComponentPath(dir, importMatch[1]);
        } else if (varMatch && !['true', 'false'].includes(varMatch[1])) {
          const importRegex = new RegExp(`import\\s+${varMatch[1]}\\s+from\\s+['"\`]([^'"\`]+)['"\`]`);
          const impMatch = content.match(importRegex);
          if (impMatch) componentFile = resolveComponentPath(dir, impMatch[1]);
        }

        entries.push({ kind: section.kind, key, componentFile });
      }
    }
  }

  return entries;
}

/** Resolve @ alias — try src/, app/, lib/, or tsconfig paths */
function resolveAlias(importPath: string): string {
  if (!importPath.startsWith('@/')) return importPath;
  const stripped = importPath.slice(2);
  for (const base of ['src', 'app', 'lib', 'libs', '.']) {
    const fullPath = resolve(CWD, base, stripped);
    if (existsSync(fullPath)) return relative(CWD, fullPath);
    for (const ext of ['.vue', '.ts', '.tsx', '.js', '.jsx']) {
      if (existsSync(fullPath + ext)) return relative(CWD, fullPath + ext);
    }
  }
  return importPath;
}

function resolveComponentPath(fromDir: string, importPath: string): string | null {
  const resolved = resolveAlias(importPath);
  if (resolved !== importPath) return resolved;

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
