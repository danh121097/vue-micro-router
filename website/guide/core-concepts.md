# Navigation & Routing

The core concepts of vue-micro-router: how paths stack, how to pass props, guard navigation, customize transitions, track history, and type your routes.

## Segment-Based Paths

Pages stack as path segments. `"home/menu/settings"` renders 3 pages simultaneously — each page slides in on top of the previous one.

```ts
const { push } = useMicroRouter();

// Push a new page on top
await push('menu');           // home → home/menu

// Push with absolute path
await push('/home/settings'); // → home/settings

// Go back one step
await push(-1);               // home/settings → home

// Go back with props (forces remount)
await push(-1, { reset: true });
```

## Navigation with Props

Pass data to pages via `push()` and read it with `useMicroState()`:

```ts
// Parent — push with props
await push('profile', { userId: 42 });
```

```vue
<!-- ProfilePage.vue -->
<script setup>
import { useMicroState } from 'vue-micro-router';

// Read props passed via push() — auto-syncs mutations back to store
const { userId } = useMicroState<{ userId: number }>();

// With defaults for optional props
const { tab } = useMicroState({ tab: 'overview' });
</script>
```

## Route Guards

Prevent or control navigation with sync/async guards:

```ts
// Global guards — run on every navigation
const config = {
  guards: {
    beforeEach: [
      async (to, from) => {
        if (to.includes('admin') && !isAuthenticated()) return false;
        return true;
      }
    ],
    afterEach: [(to, from) => analytics.track('navigate', { to, from })],
  }
};

// Per-route guards — on specific routes
defineFeaturePlugin({
  routes: [
    {
      path: 'admin',
      component: AdminPage,
      beforeEnter: async (to, from) => {
        const user = await fetchUser();
        return user.isAdmin;
      },
    },
    {
      path: 'editor',
      component: EditorPage,
      beforeLeave: (to, from) => {
        if (hasUnsavedChanges()) return confirm('Discard changes?');
        return true;
      },
    },
  ],
});
```

Guard execution order: `global beforeEach → target beforeEnter → source beforeLeave → global afterEach`

::: warning
Guards have a 5s timeout — if a guard doesn't resolve, navigation is cancelled.
:::

## Per-Route Transitions

Each route can have its own transition style and duration:

```ts
defineFeaturePlugin({
  routes: [
    { path: 'home', component: HomePage },                           // default: slide 500ms
    { path: 'settings', component: SettingsPage, transition: 'fade', transitionDuration: 300 },
    { path: 'modal-page', component: ModalPage, transition: 'none' }, // instant, no animation
  ],
});
```

Supported: `'slide'` (default), `'fade'`, `'none'`

## Navigation History

Opt-in browser-like history with back/forward:

```ts
const config = {
  history: { enabled: true, maxEntries: 50 },
};

// In any component:
const router = useMicroRouter();
router.canGoBack?.value;    // reactive boolean
router.canGoForward?.value; // reactive boolean
await router.historyBack?.();
await router.historyForward?.();
await router.historyGo?.(-2); // go back 2 entries
```

History truncates forward entries on new push (browser behavior).

## Type-Safe Routes

### Register Pattern (Recommended)

Use `Register` module augmentation to declare your plugin type once. Then `useMicroRouter()` auto-infers everywhere — no generics needed.

```ts
// app-plugin.ts — declare once with `as const`
export const appPlugin = defineFeaturePlugin({
  name: 'my-app',
  routes: [
    { path: 'home', component: HomePage },
    { path: 'profile', component: ProfilePage },
  ],
  dialogs: [{ path: 'confirm', component: ConfirmDialog, activated: false }],
  controls: [{ name: 'main_hud', component: MainHUD, activated: false }],
} as const);

// Declare module once — this is the ONLY place you write the type
declare module 'vue-micro-router' {
  interface Register {
    plugin: typeof appPlugin;
  }
}
```

Then everywhere:

```ts
// Any component — fully typed, zero generics
const { push, openDialog, toggleControl } = useMicroRouter();
push('profile');                    // ✅ OK
push('typo');                       // ❌ TS Error
openDialog('confirm');              // ✅ OK
toggleControl('main_hud', true);    // ✅ OK
```

**Benefits:** Type-safe push/openDialog/closeDialog/toggleControl. No duplication. One declaration fixes all usages.

### Manual Route Map (Alternative)

For simple cases or when you only need typed props (not route names):

```ts
interface AppRoutes {
  home: undefined;
  profile: { userId: number };
}

const router = useMicroRouter<AppRoutes>();
router.push('profile', { userId: 42 }); // ✅ OK
router.push('profile');                  // ❌ TS Error: missing props
router.push('unknown');                  // ❌ TS Error: unknown route
```

**Untyped:** `useMicroRouter()` without Register returns `MicroRouterStore` with untyped methods.

### Typed Props (Per-Route/Dialog/Control Attrs)

Opt-in per-component — export `interface Attrs` to get typed `push()` / `openDialog()` / `toggleControl()` props.

**Step 1:** In your component, export `interface Attrs`:

```vue
<!-- ProfilePage.vue -->
<script setup lang="ts">
import { useMicroState } from 'vue-micro-router';

export interface Attrs {
  userId: number;
  username: string;
  meta?: { title: string };  // optional fields OK
}

// Required fields need defaults (prevents undefined on remount)
const { userId, username, meta } = useMicroState<Attrs>({
  userId: 0,
  username: 'Guest',
});
// userId.value → number (never undefined)
// meta.value?.title → string | undefined (ref exists, value may be undefined)
</script>
```

```vue
<!-- ConfirmDialog.vue -->
<script setup lang="ts">
export interface Attrs {
  title?: string;
  message?: string;
  onConfirm?: () => void;
}
const { title, message, onConfirm } = useMicroState<Attrs>({
  title: 'Confirm',
  message: 'Are you sure?',
});
</script>
```

**Step 2:** Run code generation:

```bash
npx vue-micro-router-gen          # auto-detects src/ or app/, outputs src/vue-micro-router.d.ts
npx vue-micro-router-gen -d src   # explicit scan directory
npx vue-micro-router-gen -o types/router.d.ts  # custom output path
```

The script:
- Scans **all `.ts` files** for `defineFeaturePlugin()` calls (any folder structure)
- Resolves `@/`, `~/`, `#/` path aliases automatically
- Finds `.vue` components with `export interface Attrs`
- Generates `vue-micro-router.d.ts` with Register + AttrsMap augmentations

**Step 3:** Include in tsconfig and enjoy typed everywhere:

```jsonc
// tsconfig.json — add the generated file
{ "include": ["src/**/*.ts", "src/**/*.vue", "src/vue-micro-router.d.ts"] }
```

```ts
push('profile', { userId: 42, username: 'Danh' });  // ✅ typed, autocomplete
push('profile');                                      // ❌ TS error: missing required props
push('profile', { meta: { title: 'Hi' } });          // ✅ optional fields can be skipped
push('home');                                         // ✅ OK (no Attrs → untyped)
openDialog('confirm', { title: 'Sure?' });            // ✅ typed
```

**Rules:**
- Required fields in `Attrs` → must pass in `push()` / `openDialog()`
- Optional fields (`?`) → can skip entirely, including the whole props arg
- Routes without `export interface Attrs` → `push()` accepts any `Record<string, unknown>`
- Re-run `npx vue-micro-router-gen` after adding/changing `Attrs` interfaces
