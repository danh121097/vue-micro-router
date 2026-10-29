/**
 * `vue-micro-router-gen` (bin/gen-attrs-types.mjs) run as a consumer runs it:
 * a child process in a temporary project.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const BIN = resolve(import.meta.dir, '../bin/gen-attrs-types.mjs');

const PLUGIN = `import { defineFeaturePlugin } from 'vue-micro-router';
import ShopPage from './pages/ShopPage.vue';

const shared = { track: false };
const meta = { track: true };

export const appPlugin = defineFeaturePlugin({
  name: 'app',
  routes: [
    { path: 'home', component: () => import('./pages/HomePage.vue'), // don't drop what follows
      meta: { a: 1, note: 'x\\u0041y\\x42\\'z' } },
    {
      path: 'shop',
      component: ShopPage,
      attrs: { meta: 'not this one' },
      // a comment, then the real one
      meta: { screen: 'store', tags: ['a', "b"], depth: 2, gated: true, extra: null, },
    },
  ],
  dialogs: [
    { path: 'confirm', component: () => import('./pages/HomePage.vue'), activated: false, meta: shared },
    /* it's shorthand */ { path: 'short', component: () => import('./pages/HomePage.vue'), activated: false, meta },
  ],
  controls: [
    { name: 'main_gui', component: ShopPage, activated: false, meta: { gui: \`main\` } as const },
  ],
});
`;

const roots: string[] = [];
afterAll(() => roots.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function createProject() {
  const root = mkdtempSync(join(tmpdir(), 'vmr-gen-'));
  roots.push(root);
  mkdirSync(join(root, 'src/pages'), { recursive: true });
  writeFileSync(join(root, 'src/app-plugin.ts'), PLUGIN);
  writeFileSync(join(root, 'src/pages/HomePage.vue'), '<template><div /></template>\n');
  writeFileSync(
    join(root, 'src/pages/ShopPage.vue'),
    '<script setup lang="ts">\nexport interface Attrs { id: number }\n</script>\n'
  );
  return root;
}

function run(root: string, ...args: string[]) {
  const result = spawnSync('node', [BIN, ...args], { cwd: root, encoding: 'utf-8' });
  expect(result.status).toBe(0);
  return result;
}

describe('vue-micro-router-gen --manifest', () => {
  test('writes every definition with its literal meta and source file', () => {
    const root = createProject();
    const result = run(root, '--manifest');

    const manifest = JSON.parse(readFileSync(join(root, 'micro-router.manifest.json'), 'utf-8'));
    expect(manifest).toEqual({
      version: 1,
      routes: [
        {
          path: 'home',
          source: 'src/app-plugin.ts',
          component: 'src/pages/HomePage.vue',
          meta: { a: 1, note: "xAyB'z" }
        },
        {
          path: 'shop',
          source: 'src/app-plugin.ts',
          component: 'src/pages/ShopPage.vue',
          meta: { screen: 'store', tags: ['a', 'b'], depth: 2, gated: true, extra: null }
        }
      ],
      dialogs: [
        { path: 'confirm', source: 'src/app-plugin.ts', component: 'src/pages/HomePage.vue', meta: null },
        { path: 'short', source: 'src/app-plugin.ts', component: 'src/pages/HomePage.vue', meta: null }
      ],
      controls: [
        { name: 'main_gui', source: 'src/app-plugin.ts', component: 'src/pages/ShopPage.vue', meta: { gui: 'main' } }
      ]
    });
    expect(result.stderr).toContain("dialog 'confirm' meta is not a literal");
    expect(result.stderr).toContain("dialog 'short' meta is not a literal");
  });

  test('an escape it cannot decode makes meta non-literal, not mangled', () => {
    const root = createProject();
    writeFileSync(
      join(root, 'src/app-plugin.ts'),
      PLUGIN.replace("meta: { gui: `main` }", "meta: { gui: 'a\\u{zz}' }")
    );
    const result = run(root, '--manifest');
    const manifest = JSON.parse(readFileSync(join(root, 'micro-router.manifest.json'), 'utf-8'));
    expect(manifest.controls[0].meta).toBeNull();
    expect(result.stderr).toContain("control 'main_gui' meta is not a literal");
  });

  test('braces inside comments and strings do not cut an entry short', () => {
    const root = createProject();
    writeFileSync(
      join(root, 'src/app-plugin.ts'),
      `import { defineFeaturePlugin } from 'vue-micro-router';

export const appPlugin = defineFeaturePlugin({
  name: 'app',
  routes: [
    { path: 'r1', component: () => import('./pages/HomePage.vue'), /* a } b */ meta: { n: 1 } },
    { path: 'r2', component: () => import('./pages/HomePage.vue'), // a } b
      meta: { n: 2 } },
    { path: 'r3', component: () => import('./pages/HomePage.vue'), attrs: { title: 'a } b' }, meta: { n: 3 } },
    { path: 'r4', component: () => import('./pages/HomePage.vue') }, // a { b
    { path: 'r5', component: () => import('./pages/HomePage.vue'), attrs: { title: 'a { b' } },
    { path: 'r6', component: () => import('./pages/HomePage.vue'), /* don't */ meta: { n: 6 } },
  ],
});
`
    );
    const result = run(root, '--manifest');
    const manifest = JSON.parse(readFileSync(join(root, 'micro-router.manifest.json'), 'utf-8'));
    expect(manifest.routes.map((r: { path: string; meta?: unknown }) => [r.path, r.meta ?? 'none'])).toEqual([
      ['r1', { n: 1 }],
      ['r2', { n: 2 }],
      ['r3', { n: 3 }],
      ['r4', 'none'],
      ['r5', 'none'],
      ['r6', { n: 6 }]
    ]);
    expect(result.stderr).not.toContain('not a literal');
  });

  test('takes a custom manifest path', () => {
    const root = createProject();
    run(root, '--manifest', 'build/routes.json', '-o', 'types.d.ts');
    expect(JSON.parse(readFileSync(join(root, 'build/routes.json'), 'utf-8')).version).toBe(1);
  });

  test('leaves the type output byte-identical', () => {
    const root = createProject();
    run(root);
    const plain = readFileSync(join(root, 'vue-micro-router.d.ts'), 'utf-8');
    rmSync(join(root, 'vue-micro-router.d.ts'));
    run(root, '--manifest');
    expect(readFileSync(join(root, 'vue-micro-router.d.ts'), 'utf-8')).toBe(plain);
  });
});
