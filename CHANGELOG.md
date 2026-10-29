# Changelog

## Unreleased

### Fixed

- **GUI hooks report every control activation change.** `trackGuiEnter` /
  `trackGuiLeave` now fire exactly when a control's `activated` flips:
  - `trackGuiEnter(defaultControlName)` fires when turning a control off brings
    the default GUI (`main_gui`) back. Before, it came back silently, so a
    consumer counting shown GUIs had to watch `resolveControls` instead.
  - **Behaviour change:** no `trackGuiLeave` for a control that was already
    hidden, and no second `trackGuiEnter` for a control that was already shown
    (re-toggling still remounts it with the new attrs).
  - **Behaviour change:** within one `toggleControl`, the hides are reported
    before the show (it was show first).
  - The page-level GUI hooks (leaving / returning to the default page) are
    unchanged.

- **`vue-micro-router-gen` cuts plugin entries correctly around braces in
  comments and strings.** A `{` or `}` inside a comment or a string in a
  `routes` / `dialogs` / `controls` entry used to end the entry early or drop
  the next one from the generated types. Projects without such a brace get
  byte-identical output.

### Added

- **`tracker.onEvent(event)`** — one stream for pages, dialogs and controls,
  alongside the existing `track*` hooks (which keep firing, with the GUI hook
  fix above). Each
  `TrackerEvent` is `{ kind, phase, name, path, from, to, navigationKind?,
  closeReason?, meta? }`:
  - `phase` is `enter` / `leave` (mounted into / removed from the stack; a
    control activated / deactivated) or `cover` / `uncover` (another page or
    dialog went on top / went away). Pages cover pages, dialogs cover dialogs;
    controls never cover.
  - Every page has one `enter` and one `leave`: a multi-step back reports each
    page it removes, top first, which the `trackPageLeave` hook never did.
  - `closeReason` on leaves: `escape` and `backdrop` (from where the dialog
    already handles them, never for a `persistent` dialog), `close_button`
    (when the caller passes it), `gesture` (swipe back), `replace` (`replace()`,
    or another control taking this one's place), else `programmatic`.
  - Within one change, leaves come first; a page is covered only after its own
    enter (an absolute push to `/b/c` reports `enter b`, `cover b`, `enter c`).
  - A throwing `onEvent` is caught and logged with `console.warn`, so it never
    stops a navigation or the hooks after it.
  - `from` / `to` are `''` where there is nothing: before the first page, with
    no dialog open, or with no control active.
  - Dialog events arrive when the dialog stack changes (the tick after
    `openDialog` / `closeDialog`); re-opening an open dialog reports nothing.
- **`closeDialog(path, reason?)`** — optional `CloseReason`, reported on
  `onEvent`. Default `'programmatic'`. `PluginTypedCloseDialog` accepts it too.
- **`meta`** — optional `Record<string, unknown>` on `MicroRoute`,
  `MicroDialog` and `MicroControl`. Never read by the router; passed on
  `onEvent` and by `getRegistry()`.
- **Owner attributes** for `closest()` lookups: `data-micro-page="<segment>"`
  on `.route-page`, `data-micro-dialog="<path>"` on `.micro-dialog-portal`,
  and `data-micro-control="<name>"` on a control's root element, set after
  each render (a control whose root is a fragment or a teleport does not get
  it, and no Vue warning is raised).
- **`store.getRegistry()`** — `{ routes, dialogs, controls }`: every
  registered path or name with its `meta`, in registration order.
- **`vue-micro-router-gen --manifest [file]`** — also writes
  `micro-router.manifest.json`: every route, dialog and control with its plugin
  file, component file and literal `meta`, sorted by name. A non-literal `meta`
  (including shorthand `{ meta }`, or a string escape it cannot decode) is
  written as `null` with a warning; comments are skipped. Without the flag,
  the generated `.d.ts` is byte-identical to before.
- Exported types: `TrackerEvent`, `TrackerEventKind`, `TrackerEventPhase`,
  `CloseReason`, `MicroMeta`, `MicroRouterRegistry`.

### Changed — consumer-visible

- **`MicroRouterStore` has a new required member, `getRegistry`**, and
  `NavigationState`, `DialogManagerState` and `ControlManagerState` gained
  members (`listRoutes`, `trackCurrentPage`, `withLeaveReason`, `listDialogs`,
  `listControls`). Code that builds one as an object literal (a hand-written
  mock) must add them; code that reads the store, or casts with
  `as unknown as MicroRouterStore`, is unaffected.
- `usePageTracker()` returns `Required<PageTrackerHooks>`, which now includes
  `onEvent`; a hand-built tracker object passed to `useNavigation`,
  `useDialogManager` or `useControlManager` must add it.
- `MicroDialogComponent`'s `close` event has a second argument, the
  `CloseReason` (`'escape'` or `'backdrop'`). Listeners that take only the
  path are unaffected.

## 1.1.3 — 2026-10-28

### Added

- **`replace(segment, props?)`** on the store and the `useMicroRouter()`
  return — swap the top page for another route and animate forward.
  `/home/welcome` → `replace('quiz')` → `/home/quiz`; back from `quiz` returns
  to `home`. Until now the only way was an absolute `push('/home/quiz')`,
  which plays the back slide on the leaving page, so the swap looked like going
  back.
  - Under `slide` the new page enters from the right with `page-replace-*`
    classes while the old page stays put under the covered-page overlay.
    `fade` and `none` behave as for `push()`.
  - Same lock, guards (`beforeEach`, `beforeEnter`, the old page's
    `beforeLeave`), `afterEach`, adjacent preload and BGM update as `push()`.
  - Clears the replaced page's attrs. With history enabled, the current entry
    is overwritten (and forward entries dropped) instead of a new one added.
  - Takes a route segment name only, typed through `Register` and
    `RouteAttrsMap` like `push()` (`PluginTypedReplace`, `TypedReplace`). A
    no-op for the top page; ignored with a console warning for a segment
    already lower in the stack.
  - Also animates a replace at the root (a single-page stack), which an
    absolute push there never did.
- `store.navigationKind` — `'push' | 'back' | 'replace'`, the kind of the last
  navigation. Exported type `NavigationKind`.

### Changed — consumer-visible

- **`MicroRouterStore` and `NavigationState` have two new required members**,
  `replace` and `navigationKind`. Code that builds either as an object literal (a
  hand-written mock, say) must add them; code that only reads the store, or
  casts with `as unknown as MicroRouterStore`, is unaffected.
- **A replace does not use `page-slide-*` classes.** Consumer CSS that targets
  `.page-slide-enter-*` / `.page-slide-leave-*` does not apply to a replace;
  target `.page-replace-*` for it.

`push()` is unchanged for every existing call.

## 1.1.2 — 2026-09-09

*(Released as 1.1.2. The 1.1.0 and 1.1.1 version bumps were never published —
both publish attempts aborted at npm's 2FA prompt before uploading.)*

Two features shipped in earlier releases without ever working. Both are fixed
here, so the visible change for most consumers is that things start happening
that never happened before.

### Fixed — features that never worked

- **Swipe-back gesture.** `useGestureNavigation` bound its pointer listeners to
  the page container's `$el`. That container is a `<TransitionGroup>`, which
  rendered a fragment, so `$el` was the fragment's anchor **text node** — an
  `EventTarget`, so binding succeeded silently, but a text node never receives
  pointer events. The gesture could not fire for any consumer, in any browser,
  since it was introduced. The page stack is now a real element and the gesture
  works.
- **Vue Devtools.** `setupDevtoolsPlugin` was guarded on `import.meta.env.DEV`,
  which the library build substitutes to a constant `false` — so it returned
  immediately for every consumer while the inspector body still shipped inside
  the core entry as unreachable code. Devtools is now opt-in through
  `config.devtools` and loads as its own chunk.
- **Dialog focus.** A dialog with no `[autofocus]` input never took focus, so
  its Tab trap — a `keydown` listener on the dialog root — never received a key
  and silently did nothing. The dialog root now takes focus in that case.
- **Persistent dialog focus.** `.micro-dialog` is `pointer-events: none`, so a
  click on the dimmed area landed on the non-focusable portal and the browser
  moved focus to `<body>`. A non-persistent dialog closes on that click so it
  never showed; a persistent one stayed open with focus outside itself and its
  Tab trap stopped working for the rest of its life.

### Added

- `config.devtools?: boolean` — opt into the Vue Devtools inspector and
  timeline. Off by default. Requires `@vue/devtools-api` (optional peer
  dependency); without it the load warns and no-ops.

  Off means never *fetched*, not absent from your build: the flag is read inside
  the library, so no bundler can prove it false and the chunk still lands in
  your `dist/`. Measured on a Vite 6 consumer: eager entry −2,753 B, total
  emitted +793 B.

- `store.persistRouteAttrs(segment, attrs)` — merge attrs into a segment for
  persistence only, without notifying reactive readers. `updateRouteAttrs` keeps
  the merge-and-notify behaviour; use it whenever a mounted page must actually
  see the change. Note `getRouteAttrs` returns the stored object itself, which
  this merges into in place — copy it if you need a snapshot.

### Changed — consumer-visible

- **The page stack is now wrapped in `<div class="micro-router__pages">`.**
  `<TransitionGroup>` previously rendered a fragment, so `.route-page` elements
  were direct children of whatever contained `<MicroRouterView>`. They are now
  children of this wrapper. The wrapper carries no styles, is not a positioned
  ancestor and creates no stacking context, so `position: absolute` pages,
  `z-index` ordering against the GUI and content layers, and layout are all
  unchanged. **A selector that assumed the old structure needs updating** —
  anything matching `.route-page` as a direct child or sibling of your own
  markup.

- **`.micro-router--navigating *` was removed** from the navigation lock,
  leaving `.micro-router--navigating`. `pointer-events: none` on the ancestor
  already stops descendants receiving events, and toggling a universal selector
  forced a style recalculation across every descendant of every page, twice per
  navigation, during the transform transition.

  The removed rule carried `!important` to beat consumer CSS. **If you have a
  rule that re-enables `pointer-events` on something inside a page, it used to
  lose and now wins** — that element becomes clickable mid-transition.

- **The dialog focus trap now excludes two more things.** Elements inside an
  `aria-hidden="true"` subtree (previously only the element itself was checked,
  so controls hidden from assistive technology stayed in the trap's tab order),
  and elements that are not rendered — a `v-show`-hidden trailing control used
  to become `last`, so `active === last` never held for the control you could
  see and Tab escaped the dialog.

- **`useMicroState` write-backs no longer re-render the page.** The watcher
  synced mutations to the store through `updateRouteAttrs`, which notifies — and
  the only reactive reader of that notification is the `v-bind` that hands the
  attrs straight back to the page as props. Every mutation therefore cost the
  page a second render carrying data it had just produced; on an input bound to
  `useMicroState` that was one subtree diff per keystroke. The write-back now
  goes through `persistRouteAttrs`, so a mutation costs one render instead of two.

  The store still holds the latest state and a remounted page still reads it
  back. What changed is that a *different* component watching the same segment's
  attrs is no longer woken by a page's own write-back — nothing in the library
  did that, and `push(path, props)` and state restore are unaffected.

  This also reaches the exported `MICRO_ATTRS_WRITE_KEY`: **a page that injects
  that writer directly now persists without notifying**, where it used to merge
  and notify. The same key injected inside a dialog or a control still notifies,
  because their props come from the definition objects rather than the attrs Map
  and there was never an echo to cut. Call `updateRouteAttrs` if you need the
  write to reach reactive readers from a page.

### Performance

- Focus trap scans a focusable-candidate selector instead of every node in the
  dialog, on every Tab keypress and during autofocus settling.
- Swipe-back reads the viewport width once per gesture instead of once per
  `pointermove`, coalesces transform writes into one `requestAnimationFrame`,
  and binds `pointermove` only while a gesture is in progress.
- `will-change: transform` while a page slide runs (not permanently — that
  wastes compositor memory on stacked pages that are not moving).
- Per-page inline styles are memoised instead of rebuilt as a literal for every
  page on every page-stack render (three per navigation). Measured over one
  navigation on a four-page stack: 11 style objects and 11 transition strings
  built inline, 4 and 1 memoised. Render counts are unchanged — this is
  construction work, not a patch.
