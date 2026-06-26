import readingTime from 'reading-time';

export function sortByNewest<T extends { data: { pubDate: Date } }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getReadingMinutes(body: string): number {
  return Math.max(1, Math.round(readingTime(body).minutes));
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[>#*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
