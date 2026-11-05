import type { APIRoute } from 'astro';
import { llmsTxt } from '../lib/llms';

export const GET: APIRoute = ({ site }) => llmsTxt(site);
