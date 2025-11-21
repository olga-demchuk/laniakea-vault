# Laniakea Vault

Personal knowledge base for systematic world exploration. Topics: cosmetics, nutrition, psychology, ergonomics + fundamental sciences (biology, physics, chemistry).

**Architecture:** SPA (vanilla JS) + Express API + JSON storage  
**Key feature:** Wiki-links `[[Page]]` with automatic backlinks

## Quick Start

```bash
npm install
npm start
# → http://localhost:3000
```

## Core Concepts

**Wiki-links:** `[[Page Name]]` or `[[Page|alt text]]`  
- Blue = page exists
- Red = can be created on click
- Parsed on backend, rendered on frontend

**Tags:** `#cosmetics #acids` — extracted automatically

**Backlinks:** All incoming links displayed at bottom of page

**Knowledge graph:** Connections via `links.json`, visualization planned

## Stack

- Node.js 18+ / Express 4
- JSON storage (SQLite migration at >1000 pages)
- Marked.js for Markdown
- History API for SPA routing

## API

```
GET    /api/pages              # All pages
GET    /api/pages/:slug        # Single page
POST   /api/pages              # Create
PUT    /api/pages/:id          # Update
DELETE /api/pages/:id          # Delete
GET    /api/tags               # All tags + count
GET    /api/search?q=query     # Live search
```

## Data Model

```json
// pages.json
{
  "id": 1,
  "title": "Glycolic Acid",
  "slug": "glycolic-acid",
  "content_md": "Markdown with [[AHA Acids|AHA]]",
  "created_at": "ISO",
  "updated_at": "ISO"
}

// links.json
{
  "page_id": 1,
  "linked_page_id": 2,
  "link_type": "inline"  // or "related"
}

// tags.json
{
  "page_id": 1,
  "name": "cosmetics"
}
```

## Structure

```
├── data/              # Git-tracked JSON
│   ├── pages.json
│   ├── tags.json
│   └── links.json
├── public/
│   ├── js/app.js      # SPA + wiki-link rendering
│   └── css/style.css
├── server.js          # Express + API + parsers
└── PROJECT-CONTEXT.md # Full documentation
```

## Key Functions

**Backend (`server.js`):**
```javascript
extractWikiLinks(content)  // [[Page]] → Array<{title, alias}>
extractTags(content)       // #tag → Array<string>
generateSlug(title)        // "Привет" → "privet"
```

**Frontend (`app.js`):**
```javascript
processWikiLinks()         // Red/blue links
renderBacklinks()          // Backlinks display
```

## Dev Notes

- Slugs generated via transliteration (cyrillic-to-translit-js)
- Wiki-links parsed on save, not render (for backlinks)
- Live preview with 300ms debounce
- SPA without page reloads

## License

MIT
