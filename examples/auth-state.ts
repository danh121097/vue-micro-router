/** Simulated auth state — shared between App.vue (guard) and AdminPage (toggle) */
import { ref } from 'vue';

export const isAuthenticated = ref(true);
