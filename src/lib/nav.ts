// The synced docs/nav.yaml for code Vite bundles, where reading files relative to the module
// would point into the build output. astro.config.mjs reads the same file from disk.
import { parseNav } from './docs-nav.mjs';

const files = import.meta.glob<string>('../content/docs/docs/nav.yaml', {
  query: '?raw',
  import: 'default',
  eager: true
});
const text = Object.values(files)[0];

export const nav = text === undefined ? null : parseNav(text);
