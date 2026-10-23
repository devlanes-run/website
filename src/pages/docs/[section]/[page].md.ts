import type { CollectionEntry } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { docsMarkdown, docsMarkdownPaths } from '../../../lib/docs-markdown';

export const getStaticPaths = (() =>
  docsMarkdownPaths(3, ['section', 'page'])) satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: CollectionEntry<'docs'> }> = ({ props, site }) =>
  docsMarkdown(props.entry, site);
