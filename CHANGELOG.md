# Changelog

## 1.1.0 — 2026-09-09

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
