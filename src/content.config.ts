import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// scripts/sync-docs.mjs fills src/content/docs/ from the source repositories before each build.
export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() })
};
