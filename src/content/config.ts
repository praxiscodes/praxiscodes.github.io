import { defineCollection, z } from 'astro:content';

const baseSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const research = defineCollection({
  type: 'content',
  schema: baseSchema.extend({
    featured: z.boolean().default(false),
  }),
});

const implementations = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    status: z.enum(['Completed', 'In Progress', 'Planned']),
    order: z.number().optional(),
    repo: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    status: z.enum(['Active', 'Archived', 'Incubating']),
    tags: z.array(z.string()).default([]),
    link: z.string().url().optional(),
  }),
});

const reading = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    author: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    kind: z.enum(['Paper', 'Book', 'Essay']),
    status: z.enum(['Reading', 'Queued', 'Revisiting']),
    link: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = {
  research,
  implementations,
  projects,
  reading,
};
