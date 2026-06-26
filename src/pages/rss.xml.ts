import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../config/site';
import { sortByNewest } from '../utils/content';

export async function GET(context: { site: string | URL | undefined }) {
  const notes = sortByNewest(
    await getCollection('research', ({ data }) => {
      return !data.draft;
    }),
  );

  return rss({
    title: 'Praxis Research Notes',
    description: SITE.description,
    site: context.site ?? SITE.url,
    customData: '<language>en-us</language>',
    items: notes.map((note) => ({
      title: note.data.title,
      description: note.data.description,
      pubDate: note.data.pubDate,
      link: `/research/${note.slug}/`,
      content: note.body,
    })),
  });
}
