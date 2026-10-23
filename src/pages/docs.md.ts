import type { APIRoute } from 'astro';
import { docsAtDepth, docsMarkdown } from '../lib/docs-markdown';

export const GET: APIRoute = async ({ site }) => {
  const [entry] = await docsAtDepth(1);
  if (!entry) return new Response('Not found', { status: 404 });
  return docsMarkdown(entry, site);
};
