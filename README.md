# Laniakea Vault

Personal knowledge base with wiki-style linking. Markdown + JSON storage + SPA.

**Philosophy:** Knowledge management system for cosmetics, nutrition, psychology, ergonomics. Focus on habits, order, and common sense.

## Quick Start

```bash
npm install
npm start
# → http://localhost:3000
```

## Features

- Wiki-links: `[[Page Name]]` or `[[Page Name|alt text]]`
- Markdown with live preview
- Tags: `#tag1 #tag2`
- Automatic backlinks
- Live search
- Git-versioned content

## Stack

**Backend:** Node.js + Express + JSON storage  
**Frontend:** Vanilla JS (SPA) + Marked.js  
**Data:** `data/*.json` (pages, tags, links)

## API

```
GET    /api/pages
GET    /api/pages/:slug
POST   /api/pages
PUT    /api/pages/:id
DELETE /api/pages/:id
GET    /api/tags
GET    /api/tags/:name/pages
GET    /api/search?q=query
```

## Data Model

**pages.json:**
```json
{
  "id": 1,
  "title": "Page Title",
  "slug": "page-slug",
  "content_md": "Markdown with [[wiki-links]]",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```

**links.json:**
```json
{
  "page_id": 1,
  "linked_page_id": 2,
  "link_type": "inline" // or "related"
}
```

## Structure

```
laniakea-vault/
├── data/              # JSON storage (git-tracked)
│   ├── pages.json
│   ├── tags.json
│   └── links.json
├── public/
│   ├── js/app.js      # SPA routing, wiki-link processing
│   └── css/style.css
├── server.js          # Express + API
└── PROJECT-CONTEXT.md # Full docs
```

## Key Functions

**Backend (`server.js`):**
- `extractWikiLinks(content)` — parse `[[]]` syntax
- `extractTags(content)` — parse `#tag` syntax
- `generateSlug(title)` — transliterate to English slug

**Frontend (`app.js`):**
- `processWikiLinks()` — render blue (exists) / red (missing) links
- SPA routing via History API

## Notes

- JSON storage → migrate to SQLite when >1000 pages
- Wiki-links parsed on save (backend) and render (frontend)
- Backlinks computed from `links.json`
- All content git-versioned

## Docs

- `PROJECT-CONTEXT.md` — full project context
- `CHEATSHEET.md` — usage examples

## License

MIT
