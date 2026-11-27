import type { APIRoute } from 'astro';
import source from '../data/privacy.md?raw';

// The Markdown twin of /privacy/, served from the page's own source: converting the built HTML
// drops the opening paragraph and the last sections, and a policy has to arrive whole.
export const GET: APIRoute = () =>
  new Response(`# Privacy policy\n\n${source}`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  });
