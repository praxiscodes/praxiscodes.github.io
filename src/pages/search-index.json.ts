import { getCollection } from 'astro:content';
import { stripMarkdown } from '../utils/content';

export const prerender = true;

export async function GET() {
  const [research, implementations, projects, reading] = await Promise.all([
    getCollection('research', ({ data }) => {
      return !data.draft;
    }),
    getCollection('implementations'),
    getCollection('projects'),
    getCollection('reading'),
  ]);

  const payload = [
    ...research.map((entry) => ({
      kind: 'research',
      slug: entry.slug,
      url: `/research/${entry.slug}/`,
      title: entry.data.title,
      description: entry.data.description,
      tags: entry.data.tags,
      content: stripMarkdown(entry.body),
    })),
    ...implementations.map((entry) => ({
      kind: 'implementation',
      slug: entry.slug,
      url: '/implementations/',
      title: entry.data.title,
      description: entry.data.description,
      tags: entry.data.tags,
      content: stripMarkdown(entry.body),
    })),
    ...projects.map((entry) => ({
      kind: 'project',
      slug: entry.slug,
      url: '/projects/',
      title: entry.data.title,
      description: entry.data.description,
      tags: entry.data.tags,
      content: stripMarkdown(entry.body),
    })),
    ...reading.map((entry) => ({
      kind: 'reading',
      slug: entry.slug,
      url: '/reading/',
      title: entry.data.title,
      description: entry.data.description,
      tags: entry.data.tags,
      content: stripMarkdown(entry.body),
    })),
  ];

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
