import type { CollectionEntry } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { twin, twinPaths } from '../lib/llms';

export const getStaticPaths = twinPaths satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: CollectionEntry<'docs'> }> = ({ props, site }) =>
  twin(props.entry, site);
