<script setup lang="ts">
import { useMicroState } from '../../libs/index';

/** Exported for auto-generated dialog attrs type mapping */
export interface Attrs {
  title?: string;
  message?: string;
  onConfirm?: () => void;
}

const props = withDefaults(defineProps<{ onClose?: () => void }>(), {
  onClose: () => {}
});

const { title, message, onConfirm } = useMicroState<Attrs>({
  title: 'Confirm',
  message: 'Are you sure?',
  onConfirm: () => {
    console.log('Confirmed!');
  }
});

function handleConfirm() {
  onConfirm?.value?.();
  props.onClose();
}
</script>

<template>
  <div class="confirm-dialog">
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <div class="dialog-actions">
      <button class="btn-cancel" @click="props.onClose()">Cancel</button>
      <button class="btn-confirm" @click="handleConfirm">Confirm</button>
    </div>
  </div>
</template>

<style scoped>
.confirm-dialog {
  background: #1e293b;
  border-radius: 0.75rem;
  padding: 2rem;
  min-width: 320px;
  text-align: center;
}
h2 {
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
}
p {
  color: #94a3b8;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}
.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}
button {
  padding: 0.6rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: opacity 0.2s;
}
button:hover {
  opacity: 0.85;
}
.btn-cancel {
  background: #475569;
  color: #e2e8f0;
}
.btn-confirm {
  background: #ef4444;
  color: white;
}
</style>
