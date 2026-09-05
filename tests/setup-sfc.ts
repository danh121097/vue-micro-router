/**
 * `bun test` preload — see `bunfig.toml` `[test] preload`.
 *
 * Runs once before any test module is imported and installs the two things
 * `bun test` lacks out of the box: a `.vue` compiler and DOM globals.
 * Both are required to mount the library's SFCs.
 */
import { registerDomEnvironment } from './support/dom-environment';
import { registerVueSfcLoader } from './support/vue-sfc-loader';

registerVueSfcLoader();
registerDomEnvironment();
