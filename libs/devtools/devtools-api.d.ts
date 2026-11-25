/**
 * Type stub for the optional `@vue/devtools-api` peer dependency, covering only
 * what the inspector uses. It reads the same in versions 6, 7 and 8, so the
 * build never depends on which one, if any, is installed.
 */
declare module '@vue/devtools-api' {
  import type { App } from 'vue';

  export function setupDevtoolsPlugin(
    descriptor: {
      id: string;
      label: string;
      /** Required: devtools runs the setup only for the app named here. */
      app: App;
      packageName?: string;
      homepage?: string;
    },
    callback: (api: any) => void
  ): void;
}
