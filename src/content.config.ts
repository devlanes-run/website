import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

// scripts/sync-docs.mjs fills src/content/docs/ from the source repositories before each build.
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // Checked in the devlanes repository; the website accepts it and shows nothing for it.
      extend: z.object({
        kind: z.enum(['overview', 'learn', 'how-to', 'concept', 'reference']).optional()
      })
    })
  })
};
