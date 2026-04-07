# vue-micro-router Code Standards

**Version:** 1.0.0 (Phase 1-3 Complete)  
**Last Updated:** 2026-04-06

---

## File Organization

### Directory Structure (Updated for Phase 3)

```
libs/
├── index.ts                     # Core public API exports
├── core/
│   ├── types.ts                 # Central type definitions
│   ├── constants.ts             # Injection keys, defaults
│   └── type-helpers.ts          # RouteMap, TypedPush utilities
├── composables/
│   ├── navigation/              # Navigation state (7 files)
│   │   ├── use-navigation.ts
│   │   ├── use-navigation-guards.ts
│   │   ├── use-navigation-history.ts
│   │   ├── use-navigation-step-wise.ts
│   │   ├── use-route-registry.ts
│   │   ├── use-route-lifecycle.ts
│   │   └── use-gesture-navigation.ts
│   ├── dialog/                  # Dialog state (2 files)
│   │   ├── use-dialog-manager.ts
│   │   └── use-dialog-lifecycle.ts
│   ├── control/                 # Control state (2 files)
│   │   ├── use-control-manager.ts
│   │   └── use-control-lifecycle.ts
│   ├── use-micro-router.ts      # Store orchestrator
│   ├── use-micro-state.ts       # Reactive attrs bridge
│   ├── use-page-tracker.ts      # Analytics hooks
│   ├── use-state-serializer.ts  # State persistence
│   └── use-audio-manager.ts     # Audio management
├── components/
│   ├── MicroRouterView.vue
│   ├── RoutePage.vue
│   ├── MicroDialog.vue
│   └── MicroControlWrapper.vue
├── devtools/
│   ├── devtools-plugin.ts
│   └── devtools-api.d.ts
├── audio/
│   ├── index.ts
│   ├── audio-adapter-types.ts
│   └── howler-adapter.ts
├── plugins/
│   └── feature-plugin-manager.ts
├── styles/
│   ├── entry.ts
│   ├── index.css
│   ├── micro-router-transitions.css
│   └── dialog-transitions.css
└── utils/
    ├── path-utils.ts
    └── timer-manager.ts
```

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Composables | `use-{feature}.ts` | `use-micro-router.ts` |
| Components | `{PascalCase}.vue` | `MicroRouterView.vue` |
| Utils | `{kebab-case}.ts` | `path-utils.ts` |
| Folders | `{kebab-case}/` | `navigation/`, `dialog/`, `control/` |
| Types file | Single file | `types.ts` |
| Constants | Single file | `constants.ts` |
| Tests | `{source}.test.ts` | `path-utils.test.ts` |

### File Size Limits

- **Composables:** <250 LOC
- **Components:** <150 LOC
- **Utils:** <100 LOC per function
- **Types:** Central `types.ts` acceptable
- **Tests:** No limit

---

## TypeScript Standards

### Strict Mode (Mandatory)

All files use TypeScript strict mode:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true
  }
}
```

### Type Definitions

All exports must have explicit types. No `any`.

```typescript
// ✗ Bad
export function parseSegments(path) {
  return path.split('/');
}

// ✓ Good
export function parseSegments(path: string): string[] {
  return path.split('/');
}
```

### Generic Types

Use descriptive type parameter names:

```typescript
// ✓ Good
export function useMicroState<AttrsShape>(defaults?: AttrsShape) { }

// ✗ Bad
export function useMicroState<T>(defaults?: T) { }
```

### Union Types & Literals

Prefer literal types for finite options:

```typescript
// ✗ Bad
export type TransitionType = string;

// ✓ Good
export type TransitionType = 'fade' | 'slide' | 'none';
```

### Interface vs Type

| Use Case | Choice | Reason |
|----------|--------|--------|
| Object shape contracts | `interface` | Declaration merging, semantic |
| Union/tuple/mapped | `type` | Required for advanced features |
| Simple values | `type` | Simpler, no merging |

### JSDoc Comments

All public exports require JSDoc:

```typescript
/**
 * Parse segment-based path into array of segments.
 *
 * @param path - Path string like "home/menu/settings"
 * @returns Array of segments
 * @example
 * parsePathSegments("home/menu") // ["home", "menu"]
 */
export function parsePathSegments(path: string): string[] {
  return path.split('/');
}
```

---

## Composable Standards

### Naming Convention

All composables start with `use-`:

```typescript
// ✓ Good
export function useMicroRouter(): MicroRouterStore { }
export function useNavigation(config?: NavConfig): NavigationState { }
export function useMicroState<T>(): ToRefs<T> { }
```

### Return Types

Composables return objects or composable APIs:

```typescript
// ✓ Good: returns composable API
export function useMicroRouter() {
  return {
    activePath: computed(...),
    push: async (destination) => { },
  };
}
```

### Reactive References

Use `ref` and `computed` from Vue, not plain objects:

```typescript
// ✓ Good: reactive
const activePath = ref<string>(DEFAULT_PATH);
const activePage = computed(() => getLastSegment(activePath.value));

// ✗ Bad: not reactive
const state = { activePath: DEFAULT_PATH };
```

### Injection Errors

All `inject()` calls must handle missing providers:

```typescript
// ✓ Good: clear error message
export function useMicroRouter(): MicroRouterStore {
  const store = inject(MICRO_ROUTER_KEY);
  if (!store) {
    throw new Error(
      '[vue-micro-router] useMicroRouter() must be called inside <MicroRouterView>. ' +
      'Did you forget to wrap your app?'
    );
  }
  return store;
}

// ✗ Bad: silent failure
const store = inject(MICRO_ROUTER_KEY) || {};
```

### Cleanup & Lifecycle

Composables managing resources must call `onBeforeUnmount`:

```typescript
// ✓ Good: cleanup
onBeforeUnmount(() => {
  navigation.cleanup();
  dialogs.cleanup();
  controls.cleanup();
});

// ✗ Bad: no cleanup (memory leak)
```

---

## Component Standards

### SFC Structure

Use `<script setup lang="ts">` with this order:
1. Imports (Vue, composables, types)
2. Props/emits (if any)
3. Reactive state (refs, computed)
4. Methods (if not extractable as utils)
5. Lifecycle hooks
6. Template refs (if needed)

### Composition API Only

No Options API or class syntax:

```vue
// ✓ Good: setup script
<script setup lang="ts">
const router = useMicroRouter();
</script>

// ✗ Bad: Options API or classes
```

### Props Validation

Use TypeScript interfaces with `defineProps<Props>()`:

```typescript
interface Props {
  route: MicroRoute;
  key?: string;
}

const props = defineProps<Props>();
```

### Styling Strategy

Use scoped styles with `.micro-*` prefix. No global styles in components. Optional stylesheet via `vue-micro-router/styles`.

### Avoid Prop Drilling

Use provide/inject for deeply nested props:

```typescript
// ✓ Good: inject via key
const attrs = inject(MICRO_ATTRS_READ_KEY);

// ✗ Bad: pass props down 5 levels
```

---

## Utility Function Standards

### Pure Functions Only

Utils must be pure: same input → same output, no side effects.

```typescript
// ✓ Good: pure
export function parsePathSegments(path: string): string[] {
  return path.split('/');
}

// ✗ Bad: side effect
export function parsePathSegments(path: string): string[] {
  console.log(path);
  return path.split('/');
}
```

### Immutability

Input parameters must not be mutated:

```typescript
// ✓ Good: returns new array
export function updateSegment(
  segments: string[],
  index: number,
  value: string
): string[] {
  const copy = [...segments];
  copy[index] = value;
  return copy;
}

// ✗ Bad: mutates input
export function updateSegment(
  segments: string[],
  index: number,
  value: string
): string[] {
  segments[index] = value;
  return segments;
}
```

### Error Handling

Throw descriptive errors for invalid input:

```typescript
// ✓ Good: validates input
export function parsePathSegments(path: string): string[] {
  if (!path || typeof path !== 'string') {
    throw new Error('[vue-micro-router] Path must be non-empty string');
  }
  return path.split('/').filter(Boolean);
}
```

### Naming

Function names describe what they do; use active verbs:

```typescript
// ✓ Good: clear intent
export function buildPathFromSegments(segments: string[]): string { }
export function parsePathSegments(path: string): string[] { }
export function getLastSegment(path: string): string { }

// ✗ Bad: vague names
export function doPath(data: any) { }
export function x(p: string) { }
```

---

## Constants Standards

### Centralized in `libs/core/constants.ts`

All magic strings, injection keys, defaults in one file:

```typescript
// ✓ Good: centralized
export const MICRO_ROUTER_KEY = Symbol('micro-router');
export const MICRO_DIALOG_PATH_KEY = Symbol('micro-dialog-path');
export const MICRO_CONTROL_NAME_KEY = Symbol('micro-control-name');
export const STEP_DELAY = 600;
export const MICRO_ATTRS_READ_KEY = Symbol('micro-attrs-read');
export const MICRO_ATTRS_WRITE_KEY = Symbol('micro-attrs-write');
```

### Naming Convention

- **Injection Keys:** SCREAMING_SNAKE_CASE, end with `_KEY`
- **Defaults:** SCREAMING_SNAKE_CASE, start with `DEFAULT_`
- **Magic numbers:** Named constants with clear purpose

---

## Testing Standards

### Test File Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { parsePathSegments } from '../path-utils';

describe('path-utils', () => {
  describe('parsePathSegments', () => {
    it('parses simple path into segments', () => {
      expect(parsePathSegments('home/menu')).toEqual(['home', 'menu']);
    });

    it('handles single segment', () => {
      expect(parsePathSegments('home')).toEqual(['home']);
    });

    it('throws on empty string', () => {
      expect(() => parsePathSegments('')).toThrow();
    });
  });
});
```

### Coverage Requirements

- **Target:** 80% minimum
- **Critical paths (navigation, state sync):** 95%+
- **Utils:** 100% (pure functions)
- **Components:** 70%+ (interactive tests harder)

### Test Naming

Test names describe behavior, not implementation:

```typescript
// ✓ Good: behavior-driven
it('parses path into segments by slash delimiter', () => { });
it('throws when path is empty', () => { });

// ✗ Bad: implementation-focused
it('calls split method', () => { });
it('returns array', () => { });
```

---

## Error Handling

### Error Messages

All error messages must:
1. Identify package: `[vue-micro-router]`
2. Describe problem clearly
3. Suggest a fix

```typescript
// ✓ Good: informative
throw new Error(
  '[vue-micro-router] useMicroRouter() must be called inside <MicroRouterView>. ' +
  'Did you forget to wrap your app with <MicroRouterView>?'
);

// ✗ Bad: vague
throw new Error('Router not found');
```

### Warning vs Error

- **Warn:** Configuration issue, app might work
- **Error:** Runtime failure, app cannot continue

```typescript
// ✓ Good: warn on config issue
if (!readAttrs && !defaults) {
  console.warn(
    '[vue-micro-router] useMicroState() called without provider and no defaults. ' +
    'Ensure component is inside <RoutePage>, <MicroDialog>, or <MicroControlWrapper>.'
  );
}

// ✓ Good: error on runtime failure
if (!store) {
  throw new Error('[vue-micro-router] Store not provided...');
}
```

---

## Import/Export Standards

### Export Organization

Group exports by type:

```typescript
// ── Types ──
export type { MicroRoute, MicroDialog, MicroControl };

// ── Constants ──
export { MICRO_ROUTER_KEY, STEP_DELAY };

// ── Composables ──
export { useMicroRouter, useNavigation };

// ── Components ──
export { MicroRouterView, RoutePage };

// ── Utils ──
export { parsePathSegments, buildPathFromSegments };
```

### Import Order

```typescript
// 1. Vue imports
import { ref, computed, inject } from 'vue';

// 2. Internal types
import type { MicroRoute, MicroRouterStore } from '../types';

// 3. Internal composables
import { useNavigation } from './use-navigation';

// 4. Internal utils
import { parsePathSegments } from '../utils/path-utils';

// 5. Constants
import { MICRO_ROUTER_KEY } from '../constants';
```

---

## Documentation Standards

### JSDoc for Public API

All exports require JSDoc with examples:

```typescript
/**
 * Main composable for managing micro-router state.
 *
 * Call once in root MicroRouterView to create the store.
 * Call useMicroRouter in components to inject the store.
 *
 * @param config - Router configuration (optional)
 * @returns Store API with navigation, dialog, control methods
 *
 * @example
 * // In MicroRouterView component:
 * const router = useGlobalMicroRouter({ defaultPath: 'home' });
 *
 * @example
 * // In child component:
 * const router = useMicroRouter();
 * router.push('menu');
 */
export function useGlobalMicroRouter(config?: MicroRouterConfig): MicroRouterStore { }
```

### Inline Comments

Use inline comments for non-obvious logic:

```typescript
// ✓ Good: explains why
// flush: 'post' batches the write-back watcher after the render cycle ends,
// avoiding synchronous updates during render
watch(
  () => ({ ...state }),
  (newState) => writeAttrs(newState),
  { deep: true, flush: 'post' }
);

// ✗ Bad: restates code
const copy = [...array]; // copies array
```

---

## Performance Standards

### Computed vs Ref

Prefer `computed` for derived state:

```typescript
// ✓ Good: computed, re-evaluated only when deps change
const activePage = computed(() => getLastSegment(activePath.value));

// ✗ Bad: ref, stale if not manually updated
const activePage = ref('');
watch(activePath, (path) => {
  activePage.value = getLastSegment(path);
});
```

### Watchers: Deep vs Shallow

Use shallow watchers by default:

```typescript
// ✓ Good: shallow, efficient
watch(
  () => ({ ...state }),
  (newState) => writeAttrs(newState),
  { flush: 'post' }
);

// ✗ Bad: deep watching everything
watch(state, (newState) => writeAttrs(newState), { deep: true });
```

### Memoization

Avoid unnecessary object creation in computed:

```typescript
// ✓ Good: returns primitive
const activePage = computed(() => getLastSegment(activePath.value));

// ✗ Bad: creates new object each time
const pageInfo = computed(() => ({
  page: getLastSegment(activePath.value)
}));
```

---

## Commands & Tools

### Development
```bash
bun run lint           # Check code with ESLint
bun run lint:fix       # Auto-fix ESLint issues
bun run typecheck      # TypeScript strict check
bun test               # Run all tests
bun test --coverage    # Coverage report
bun run build          # Build package
bun run bench          # Benchmark performance
bun run bench:size     # Bundle size analysis
```

### Pre-commit
1. `bun run lint:fix` — auto-fix ESLint issues
2. `bun run typecheck` — verify no TS errors
3. `bun test` — verify all tests pass
4. `bun run build` — verify build succeeds

### Code Review Checklist

Before submitting PR, verify:

- [ ] ESLint passes: `bun run lint`
- [ ] All TypeScript strict mode checks pass
- [ ] All tests pass and coverage ≥80%
- [ ] No `console.log` or `debugger` statements
- [ ] JSDoc comments on all public exports
- [ ] Error messages are clear with `[vue-micro-router]` prefix
- [ ] No new `any` types introduced
- [ ] Imports organized (Vue, types, composables, utils, constants)
- [ ] Files under size limits (composables <250 LOC, components <150 LOC, utils <100 LOC)
- [ ] No prop drilling (use provide/inject)
- [ ] Cleanup on unmount for resources
- [ ] Register pattern used for type-safe routes (if applicable)
- [ ] Commit message follows conventional format

---

## Commit Message Standards

Follow conventional commits: `<type>(<scope>): <description>`

**Types:** feat | fix | docs | refactor | test | chore | style  
**Scope:** router | dialog | control | audio | types | history | serialization | gesture | devtools | components (optional)

**Examples:**
- `feat(router): add stepWisePush navigation method`
- `fix(guards): handle async guard cancellation`
- `docs: update architecture guide`
- `test(gesture): add swipe-back detection tests`

---

## Anti-Patterns

| Avoid | Prefer |
|-------|--------|
| `any` types | Explicit types |
| Mutating parameters | Creating new objects |
| Global state | Provide/inject pattern |
| Conditional composable calls | Top-level setup |
| Mixed APIs (Options + Composition) | Composition API only |
| UI logic in types.ts | Keep for data contracts |
| TypeScript errors | Fix all errors |
| CommonJS require | ESM imports |
| Magic numbers | Named constants |
| Silent error handling | Throw descriptive errors |
| Prop drilling | Use provide/inject |
| Memory leaks | Cleanup on unmount |

---

## Type-Safe Routes: Register Pattern

### Module Augmentation (Recommended)

Declare your plugin type once using the `Register` interface. Then `useMicroRouter()` auto-infers everywhere — no generics needed.

```typescript
// app-plugin.ts — declare once with `as const`
export const appPlugin = defineFeaturePlugin({
  name: 'app',
  routes: [
    { path: 'home', component: HomePage },
    { path: 'profile', component: ProfilePage },
  ],
  dialogs: [{ path: 'confirm', component: ConfirmDialog, activated: false }],
  controls: [{ name: 'main_hud', component: MainHUD, activated: false }],
} as const);

// env.d.ts or app-plugin.ts — declare module once
declare module 'vue-micro-router' {
  interface Register {
    plugin: typeof appPlugin;
  }
}
```

Benefits:
- Zero duplication — one declaration fixes all usages
- Full autocomplete on push/openDialog/closeDialog/toggleControl
- Type errors if you use non-existent routes/dialogs/controls
- Works across entire app without passing generics

### Typed Props (Per-Route/Dialog/Control Attrs)

Components export `interface Attrs` for typed `push()` / `openDialog()` props:

```vue
<!-- ProfilePage.vue -->
<script setup lang="ts">
export interface Attrs {
  userId: number;
  username: string;
  meta?: { title: string };
}
const { userId, username, meta } = useMicroState<Attrs>({ userId: 0, username: 'Guest' });
</script>
```

Run `npx vue-micro-router-gen` to auto-generate type augmentations:
- Auto-detects `src/` or `app/` as scan dir, outputs `src/vue-micro-router.d.ts`
- Scans all `.ts` files for `defineFeaturePlugin()` (any folder structure)
- Resolves `@/`, `~/`, `#/` path aliases
- Reports typed vs untyped counts per category

```ts
push('profile', { userId: 42, username: 'Danh' }); // ✅ typed (required fields)
push('profile');                                     // ❌ missing required props
push('profile', { meta: { title: 'Hi' } });         // ✅ optional fields can skip
push('home');                                        // ✅ no attrs = untyped
```

Augmented interfaces: `RouteAttrsMap`, `DialogAttrsMap`, `ControlAttrsMap`.

**Rules:**
- Required fields → must pass in push/openDialog
- Optional fields (`?`) → can omit entirely including the props arg
- Re-run `npx vue-micro-router-gen` after adding/changing Attrs

### Type-Level Testing

Test Register pattern with `type-register.test.ts`:

```typescript
import { describe, it } from 'bun:test';
import type { ExtractRoutePaths, HasRegisteredPlugin } from './type-helpers';
import type { AppPlugin } from '../examples/app-plugin';

describe('Register pattern', () => {
  it('extracts route paths from plugin', () => {
    type Routes = ExtractRoutePaths<AppPlugin>;
    type Test = Routes extends 'home' | 'profile' ? true : false;
    const t: Test = true;
  });

  it('detects registered plugin', () => {
    type IsRegistered = HasRegisteredPlugin;
    type Test = IsRegistered extends true ? true : false;
    const t: Test = true;
  });
});
```

---

## Phase 3 Additions (Composables Restructure)

### Navigation Folder Organization

Extract navigation-related composables into `libs/composables/navigation/`:
- `use-navigation.ts` — core page stack management
- `use-navigation-guards.ts` — guard pipeline runner
- `use-navigation-history.ts` — history tracking
- `use-navigation-step-wise.ts` — step-by-step navigation
- `use-route-registry.ts` — route catalog management
- `use-route-lifecycle.ts` — route enter/leave hooks
- `use-gesture-navigation.ts` — swipe-back gesture

**Rationale:** Logical grouping, easier to navigate, separation of concerns.

### Dialog & Control Folders

Create `libs/composables/dialog/` and `libs/composables/control/`:
- Each folder contains manager + lifecycle composable
- Consistent structure with navigation folder
- Self-contained, independent domains

### Import Pattern

Composables follow `use-{feature}.ts` pattern. Import from organized folders:

```typescript
// ✓ Good: clear organization
import { useNavigation } from './navigation/use-navigation';
import { useDialogManager } from './dialog/use-dialog-manager';
import { useMicroRouter } from './use-micro-router';
```
