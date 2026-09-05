/**
 * Bun plugin that compiles `.vue` single-file components for `bun test`.
 *
 * Bun has no built-in SFC support, which is why the four library components
 * had no test coverage. `vue/compiler-sfc` — re-exported by `vue` itself, so
 * compiler and runtime can never drift apart — turns each SFC into one ES
 * module; Bun's `ts` loader then transpiles the TypeScript it emits.
 *
 * `<script setup>` blocks are compiled with `inlineTemplate: true`, so the
 * render function lands inside the component's setup closure — the same shape
 * `@vitejs/plugin-vue` produces for a production build. Components without
 * `<script setup>` get their template compiled separately and attached.
 */
import { plugin } from 'bun';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc';

/** Local binding the compiled component is assigned to before it is exported. */
const COMPONENT_LOCAL = '__sfc_component__';

/** Stable per-file id — scopes the compiled template and any scoped styles. */
function scopeId(filename: string): string {
  return createHash('sha256').update(filename).digest('hex').slice(0, 8);
}

/** Compile one SFC source string into an ES module. */
export function compileSfc(source: string, filename: string): string {
  const { descriptor, errors } = parse(source, { filename });
  if (errors.length > 0) {
    throw new Error(`[vue-sfc-loader] failed to parse ${filename}: ${errors[0]?.message}`);
  }

  const id = scopeId(filename);
  const hasScriptSetup = Boolean(descriptor.scriptSetup);
  const hasScript = Boolean(descriptor.script);
  const chunks: string[] = [];

  if (hasScript || hasScriptSetup) {
    // inlineTemplate only applies to <script setup>; a plain <script> keeps a
    // separate render function so the template can still close over its scope.
    const compiled = compileScript(descriptor, {
      id,
      inlineTemplate: hasScriptSetup,
      genDefaultAs: COMPONENT_LOCAL
    });
    chunks.push(compiled.content);
  } else {
    chunks.push(`const ${COMPONENT_LOCAL} = {};`);
  }

  if (descriptor.template && !hasScriptSetup) {
    const template = compileTemplate({
      id,
      filename,
      source: descriptor.template.content,
      isProd: false
    });
    if (template.errors.length > 0) {
      throw new Error(
        `[vue-sfc-loader] failed to compile the template of ${filename}: ${template.errors[0]}`
      );
    }
    chunks.push(template.code.replace('export function render', 'function render'));
    chunks.push(`${COMPONENT_LOCAL}.render = render;`);
  }

  chunks.push(`${COMPONENT_LOCAL}.__file = ${JSON.stringify(filename)};`);
  chunks.push(`export default ${COMPONENT_LOCAL};`);
  return chunks.join('\n');
}

/** Register the `.vue` loader with Bun's module resolver. Call from the preload. */
export function registerVueSfcLoader(): void {
  plugin({
    name: 'vue-sfc-loader',
    setup(build) {
      build.onLoad({ filter: /\.vue$/ }, (args) => ({
        contents: compileSfc(readFileSync(args.path, 'utf8'), args.path),
        loader: 'ts'
      }));
    }
  });
}
