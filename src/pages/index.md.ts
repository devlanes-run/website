import type { APIRoute } from 'astro';
import { fromHtml } from 'astro-slop';

// The build integration converts the completed HTML before slop assembles its indexes.
export const GET: APIRoute = (context) =>
  context.isPrerendered ? new Response('') : fromHtml('/')(context);
