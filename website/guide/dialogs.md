# Dialogs

Open modal dialogs with props and handle close. Dialogs stack independently of the page navigation, each with its own lifecycle and transitions.

## Open, close, and pass props

```ts
const { openDialog, closeDialog, closeAllDialogs } = useMicroRouter();

// Open with props
openDialog('confirm', {
  title: 'Delete item?',
  onConfirm: () => handleDelete(),
});

// Close specific dialog
closeDialog('confirm');

// Close all open dialogs
closeAllDialogs();
```

## Dialog options

```ts
registerDialog({
  path: 'settings-modal',
  component: SettingsModal,
  activated: false,
  position: 'right',          // 'standard' | 'top' | 'right' | 'bottom' | 'left'
  transition: 'slide',        // 'fade' | 'slide' | 'scale'
  transitionDuration: 400,
  fullscreen: false,
  persistent: true,           // prevent close on backdrop click / Escape
  seamless: true,             // transparent background, no shadow
});
```

## Reading dialog props

Inside a dialog component, read props with `useMicroState()` — same bridge as pages:

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

See [GUI Controls & Lifecycle](/guide/controls) for dialog lifecycle hooks (`onDialogEnter` / `onDialogLeave`).
