import type { APIRoute } from 'astro';
import { llmsFullTxt } from '../lib/llms';

export const GET: APIRoute = ({ site }) => llmsFullTxt(site);
