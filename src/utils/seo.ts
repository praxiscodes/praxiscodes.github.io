import { SITE } from '../config/site';

export function toAbsoluteUrl(pathname: string): string {
  return new URL(pathname, SITE.url).toString();
}

export function normalizePath(pathname: string): string {
  if (!pathname) {
    return '/';
  }

  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const looksLikeFile = /\.[a-z0-9]+$/i.test(withLeadingSlash);

  if (withLeadingSlash === '/' || looksLikeFile || withLeadingSlash.endsWith('/')) {
    return withLeadingSlash;
  }

  return `${withLeadingSlash}/`;
}

export function socialCardPath(pathname: string): string {
  const normalized = normalizePath(pathname);
  const cleaned = normalized.replace(/^\/+|\/+$/g, '');
  const slug = cleaned.length === 0 ? 'home' : cleaned;
  return `/og/${slug}.svg`;
}
