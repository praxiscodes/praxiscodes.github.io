import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';

interface CardProps {
  section: string;
  title: string;
  subtitle: string;
}

const STATIC_CARDS: Array<CardProps & { slug: string }> = [
  {
    slug: 'home',
    section: 'PRAXIS',
    title: 'Understanding intelligence by building it.',
    subtitle: 'A long-cycle research notebook on AI systems and first principles.',
  },
  {
    slug: 'research',
    section: 'Research Notes',
    title: 'Technical notes and derivations',
    subtitle: 'World models, reinforcement learning, representation learning, and agents.',
  },
  {
    slug: 'implementations',
    section: 'Implementations',
    title: 'Systems built from papers',
    subtitle: 'Gridworld, RSSM, Dreamer, MuZero, TD-MPC2, and related reproductions.',
  },
  {
    slug: 'projects',
    section: 'Projects',
    title: 'Long-form AI systems work',
    subtitle: 'Artifacts that emerge from implementation and repeated study loops.',
  },
  {
    slug: 'reading',
    section: 'Reading List',
    title: 'Papers, books, and essays',
    subtitle: 'The references behind current investigations.',
  },
  {
    slug: 'notes',
    section: 'Notes',
    title: 'Subjects and chaptered notes',
    subtitle: 'Structured notes for deep dives across core AI domains.',
  },
  {
    slug: 'about',
    section: 'About',
    title: 'Praxis research identity',
    subtitle: 'A minimal archive dedicated to first-principles understanding of intelligence.',
  },
  {
    slug: '404',
    section: 'Error 404',
    title: 'Archive page not found',
    subtitle: 'The note may have moved while the notebook evolved.',
  },
];

function escapeXml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function truncate(input: string, length: number): string {
  return input.length <= length ? input : `${input.slice(0, length - 1).trim()}...`;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const notes = await getCollection('research', ({ data }) => {
    return !data.draft;
  });

  const noteCards = notes.map((note) => ({
    params: { slug: `research/${note.slug}` },
    props: {
      section: 'Research Note',
      title: note.data.title,
      subtitle: note.data.description,
    } satisfies CardProps,
  }));

  const staticCards = STATIC_CARDS.map((card) => ({
    params: { slug: card.slug },
    props: {
      section: card.section,
      title: card.title,
      subtitle: card.subtitle,
    } satisfies CardProps,
  }));

  return [...staticCards, ...noteCards];
};

export const GET: APIRoute = async ({ props }) => {
  const card = props as CardProps;

  const section = escapeXml(truncate(card.section, 40));
  const title = escapeXml(truncate(card.title, 84));
  const subtitle = escapeXml(truncate(card.subtitle, 130));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Praxis social card">
  <defs>
    <style>
      .bg { fill: #050505; }
      .frame { fill: none; stroke: #1b1b1b; stroke-width: 2; }
      .label { fill: #9a9a9a; font: 500 22px 'IBM Plex Mono', monospace; letter-spacing: 2.5px; text-transform: uppercase; }
      .title { fill: #eaeaea; font: 600 64px 'IBM Plex Sans', sans-serif; letter-spacing: -0.5px; }
      .subtitle { fill: #9a9a9a; font: 400 28px 'IBM Plex Sans', sans-serif; }
      .mark { fill: #eaeaea; font: 500 20px 'IBM Plex Mono', monospace; letter-spacing: 1.8px; }
    </style>
  </defs>
  <rect class="bg" width="1200" height="630" />
  <rect class="frame" x="38" y="38" width="1124" height="554" />
  <text class="label" x="86" y="115">${section}</text>
  <text class="title" x="86" y="262">${title}</text>
  <text class="subtitle" x="86" y="338">${subtitle}</text>
  <text class="mark" x="86" y="540">PRAXIS / RESEARCH NOTEBOOK</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
