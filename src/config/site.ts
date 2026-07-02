export const SITE = {
  name: 'PRAXIS',
  title: 'PRAXIS | Research Notebook',
  description: 'Understanding intelligence by building it.',
  url: 'https://praxiscodes.github.io',
  github: 'https://github.com/praxiscodes',
};

export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'home', href: '/' },
  { label: 'blog', href: '/blog/' },
  { label: 'research', href: '/research/' },
  { label: 'notes', href: '/notes/' },
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
