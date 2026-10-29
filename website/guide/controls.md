# GUI Controls & Lifecycle

Persistent overlay controls (HUDs, toolbars), lifecycle hooks, feature plugins, analytics tracking, and devtools.

## GUI Controls

Persistent overlay controls that auto-manage visibility:

```ts
const { toggleControl } = useMicroRouter();

// Show inventory HUD (auto-hides default main_gui)
toggleControl('inventory', true, { filter: 'weapons' });

// Hide inventory (auto-restores main_gui)
toggleControl('inventory', false);
```

## Lifecycle Hooks

iOS-style `viewWillAppear` / `viewWillDisappear` — available for routes, dialogs, and controls:

```vue
<script setup>
import { useRouteLifecycle } from 'vue-micro-router';

useRouteLifecycle({
  onRouteEnter: () => console.log('Page is now the active (top) page'),
  onRouteLeave: () => console.log('Page is no longer the active page'),
});
</script>
```

Also: `useDialogLifecycle({ onDialogEnter, onDialogLeave })` and `useControlLifecycle({ onControlEnter, onControlLeave })`.

## Feature Plugins

Bundle routes, dialogs, and controls into feature modules:

```ts
import { defineFeaturePlugin } from 'vue-micro-router';

export const shopPlugin = defineFeaturePlugin({
  name: 'shop',
  routes: [
    { path: 'shop', component: () => import('./ShopPage.vue'), preload: 'eager' },
    { path: 'cart', component: () => import('./CartPage.vue'), preload: 'adjacent' },
  ],
  dialogs: [
    { path: 'buy-confirm', component: () => import('./BuyConfirm.vue'), activated: false },
  ],
  controls: [
    { name: 'shop_hud', component: () => import('./ShopHUD.vue'), activated: false },
  ],
});
```

## Analytics / Page Tracking

Hook into navigation events:

```ts
const config: MicroRouterConfig = {
  tracker: {
    trackPageEnter: (page, from, to) => analytics.track('page_view', { page }),
    trackPageLeave: (page, from, to) => analytics.track('page_leave', { page }),
    trackDialogEnter: (dialog) => analytics.track('dialog_open', { dialog }),
    trackDialogLeave: (dialog) => analytics.track('dialog_close', { dialog }),
    trackGuiEnter: (name) => analytics.track('gui_show', { name }),
    trackGuiLeave: (name) => analytics.track('gui_hide', { name }),
  },
};
```

`trackGuiEnter` / `trackGuiLeave` fire once per control whose activation
actually changes — including the default GUI coming back when another control
is turned off — and also when the stack leaves / returns to the default page.

### `onEvent` — one stream for pages, dialogs and controls

```ts
tracker: {
  onEvent: (e) => analytics.track(`${e.kind}_${e.phase}`, e),
}
```

Each `TrackerEvent` is `{ kind, phase, name, path, from, to, navigationKind?, closeReason?, meta? }`:

| Field | Meaning |
|-------|---------|
| `kind` | `'page'`, `'dialog'` or `'control'` |
| `phase` | `'enter'` / `'leave'` — mounted into / removed from its stack (a control: activated / deactivated). `'cover'` / `'uncover'` — still mounted, but another page (pages) or dialog (dialogs) went on top of it / went away. Controls never cover. |
| `name` / `path` | Segment and its full stack path (`menu`, `/home/menu`); dialog path; control name |
| `from` / `to` | Before → after: active path, top dialog, or `currentControl` — `''` where there is none |
| `navigationKind` | Page events: `'push'`, `'back'` or `'replace'` |
| `closeReason` | `leave` only: `'escape'` and `'backdrop'` (dialog dismissed itself), `'close_button'` (`closeDialog(path, 'close_button')`), `'gesture'` (swipe back), `'replace'` (`replace()`, or another control took this control's place), else `'programmatic'` |
| `meta` | The definition's `meta`, when it has one |

Within one change, leaves come first, then covers, uncovers and enters; a page
is covered only after its own enter (an absolute push to `/b/c` reports
`enter b`, `cover b`, `enter c`). A multi-step back reports a
`leave` for every page it removes, top first. Dialog events arrive when the
dialog stack actually changes — the tick after `openDialog` / `closeDialog`,
with `activeDialog` — and re-opening a dialog that is already open reports
nothing. Page-level GUI hiding (leaving
the default page) is reported to `trackGuiLeave` only, not as a control event.
The `track*` hooks still fire alongside `onEvent`; the GUI hooks now follow
the activation changes described above.

### `meta`, owner attributes and the registry

- Any route, dialog or control can carry `meta: Record<string, unknown>`. The
  router never reads it; it rides along on every `onEvent` and in
  `store.getRegistry()`.
- The wrappers carry their owner for `closest()` lookups: `.route-page` has
  `data-micro-page="<segment>"`, `.micro-dialog-portal` has
  `data-micro-dialog="<path>"`, and a control's root element gets
  `data-micro-control="<name>"`. The router sets it on the element after each
  render of the control; a control whose root is not a single element (a
  fragment or a teleport) does not get it.
- `store.getRegistry()` returns `{ routes, dialogs, controls }` — every
  registered path or name with its `meta`, in registration order.
- `npx vue-micro-router-gen --manifest [file]` writes the same list from source,
  with each definition's plugin file and component, to
  `micro-router.manifest.json` (sorted by name). `meta` is read as a literal; a
  non-literal `meta` (a variable, shorthand `{ meta }`, a call) is written as
  `null` with a warning.

## Vue Devtools

Opt in with `config.devtools: true` — shows a "Micro Router" inspector tab with:
- Current path and page stack
- Open dialogs with attrs
- Active controls
- Navigation timeline events

```ts
const config: MicroRouterConfig = {
  defaultPath: 'home',
  devtools: import.meta.env.DEV, // keep it out of your production builds
};
```

Requires `@vue/devtools-api` (optional peer dependency); without it the load
warns and no-ops. The inspector is loaded with a dynamic `import()`, so it is a
separate chunk that is never fetched while the flag is off, and the core entry
carries none of it.

Off means never fetched, not absent from your build output: `config.devtools`
is read inside the library, so no bundler can prove it false and the chunk still
lands in your `dist/` (measured: eager entry −2,753 B, total emitted +793 B).
Setting it from `import.meta.env.DEV` keeps devtools out of what production
*runs*, not out of what it *ships*.
