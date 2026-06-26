# PRAXIS Research Notebook

Production-ready personal research website built with **Astro + Tailwind CSS**, designed as a long-term monochrome archive for AI research notes and implementations.

Live target: `https://praxiscodes.github.io`

## Stack

- Astro (static output)
- Tailwind CSS
- MDX content collections
- Shiki syntax highlighting
- KaTeX math rendering
- Mermaid diagrams (client-rendered)
- Local full-text search (Fuse.js, no external API)
- RSS feed + sitemap + robots

## Included Features

- Editorial monochrome design system with IBM Plex Sans / IBM Plex Mono
- Always-dark theme (no light mode toggle)
- Research notes in MDX with:
  - equations
  - mermaid diagrams
  - syntax highlighting
  - callouts
  - footnotes
  - images and tables
- Reading time automation
- Table of contents for each note
- Previous/next note navigation
- Reading progress bar
- Copy button on code blocks
- Back-to-top button
- Image zoom inside article content
- Auto-generated OG/Twitter metadata and social cards
- 404 page
- GitHub Pages CI/CD workflow

## Folder Structure

```text
/
├── content/
├── research/
├── projects/
├── implementations/
├── reading/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── config/
│   ├── content/
│   │   ├── research/
│   │   ├── implementations/
│   │   ├── projects/
│   │   └── reading/
│   ├── layouts/
│   ├── pages/
│   ├── styles/
│   └── utils/
└── .github/workflows/deploy.yml
```

## Local Development

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Push this repository to the `main` branch.
2. In GitHub repository settings, open **Pages**.
3. Under **Build and deployment**, set source to **GitHub Actions**.
4. The included workflow (`.github/workflows/deploy.yml`) builds and deploys automatically on each push to `main`.

## Content Workflow

- Add new research notes in `src/content/research/*.mdx`.
- Add new implementation logs in `src/content/implementations/*.mdx`.
- Add projects in `src/content/projects/*.mdx`.
- Add reading items in `src/content/reading/*.mdx`.

RSS, sitemap, search index, and social cards update automatically at build time.
