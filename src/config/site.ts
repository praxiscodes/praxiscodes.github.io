export const SITE = {
  name: 'PRAXIS',
  title: 'PRAXIS | Research Notebook',
  description: 'Understanding intelligence by building it.',
  url: 'https://praxiscodes.github.io',
  github: 'https://github.com/praxiscodes',
};

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Research Notes', href: '/research/' },
  { label: 'Implementations', href: '/implementations/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'Reading List', href: '/reading/' },
  { label: 'About', href: '/about/' },
  { label: 'GitHub', href: SITE.github, external: true },
  { label: 'RSS', href: '/rss.xml' },
];

export const INVESTIGATIONS = [
  'World Models',
  'Reinforcement Learning',
  'Representation Learning',
  'Agents',
  'AI Systems',
];

export const IMPLEMENTATION_STATUS = {
  completed: 'Completed',
  progress: 'In Progress',
  planned: 'Planned',
} as const;

export type ImplementationStatus =
  (typeof IMPLEMENTATION_STATUS)[keyof typeof IMPLEMENTATION_STATUS];
