import type { APIRoute } from 'astro';
import { examplesIndex } from '../lib/llms';

// The Markdown twin of /examples/, written from the catalogue instead of converted from HTML.
export const GET: APIRoute = ({ site }) => examplesIndex(site);
