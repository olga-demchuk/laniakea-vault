require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/media', express.static('media'));

// Data storage paths
const DATA_DIR = path.join(__dirname, 'data');
const PAGES_FILE = path.join(DATA_DIR, 'pages.json');
const TAGS_FILE = path.join(DATA_DIR, 'tags.json');
const LINKS_FILE = path.join(DATA_DIR, 'links.json');

// Initialize data directory and files
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync('media/images')) {
  fs.mkdirSync('media/images', { recursive: true });
}

function initDataFile(filepath, defaultData) {
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(defaultData, null, 2));
  }
}

initDataFile(PAGES_FILE, []);
initDataFile(TAGS_FILE, []);
initDataFile(LINKS_FILE, []);

// Helper functions
function readJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function generateSlug(title) {
  const translitMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  
  let slug = title.toLowerCase();
  
  // Транслитерация
  slug = slug.split('').map(char => translitMap[char] || char).join('');
  
  // Удалить всё кроме букв, цифр, пробелов и дефисов
  slug = slug.replace(/[^a-z0-9\s-]/g, '');
  
  // Пробелы в дефисы
  slug = slug.replace(/\s+/g, '-');
  
  // Множественные дефисы в один
  slug = slug.replace(/-+/g, '-');
  
  // Убрать дефисы в начале/конце
  slug = slug.replace(/^-+|-+$/g, '');
  
  return slug;
}

function extractTags(content) {
  const hashtagRegex = /#([а-яА-Яa-zA-Z0-9_-]+)/g;
  const tags = [];
  let match;
  
  while ((match = hashtagRegex.exec(content)) !== null) {
    tags.push(match[1].toLowerCase());
  }
  
  return [...new Set(tags)]; // Убрать дубликаты
}

function extractWikiLinks(content) {
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links = [];
  let match;
  
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    links.push({
      title: match[1].trim(),
      displayText: match[2] ? match[2].trim() : match[1].trim()
    });
  }
  
  return links;
}

function renderWikiLinks(content, pages) {
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, title, displayText) => {
    const linkTitle = title.trim();
    const linkText = displayText ? displayText.trim() : linkTitle;
    const linkedPage = pages.find(p => p.title.toLowerCase() === linkTitle.toLowerCase());
    
    if (linkedPage) {
      return `<a href="/page/${linkedPage.slug}" class="wiki-link">${linkText}</a>`;
    } else {
      return `<a href="/page/${generateSlug(linkTitle)}?create=true" class="wiki-link-missing">${linkText}</a>`;
    }
  });
}

// API Endpoints

// GET /api/pages - получить все страницы
app.get('/api/pages', (req, res) => {
  try {
    const pages = readJSON(PAGES_FILE);
    const tags = readJSON(TAGS_FILE);
    const links = readJSON(LINKS_FILE);
    
    const pagesWithMeta = pages.map(page => {
      const pageTags = tags.filter(t => t.page_id === page.id).map(t => t.name);
      const pageLinks = links.filter(l => l.page_id === page.id);
      const backlinks = links.filter(l => l.linked_page_id === page.id);
      
      return {
        ...page,
        tags: pageTags,
        links_count: pageLinks.length,
        backlinks_count: backlinks.length
      };
    });
    
    res.json({ pages: pagesWithMeta, total: pagesWithMeta.length });
  } catch (error) {
    console.error('[API] Error getting pages:', error);
    res.status(500).json({ error: 'Failed to get pages' });
  }
});

// GET /api/pages/:slug - получить страницу по slug
app.get('/api/pages/:slug', (req, res) => {
  try {
    const pages = readJSON(PAGES_FILE);
    const tags = readJSON(TAGS_FILE);
    const links = readJSON(LINKS_FILE);
    
    const page = pages.find(p => p.slug === req.params.slug);
    
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    // Теги страницы
    const pageTags = tags
      .filter(t => t.page_id === page.id)
      .map(t => ({ name: t.name }));
    
    // Inline links
    const inlineLinks = links
      .filter(l => l.page_id === page.id && l.link_type === 'inline')
      .map(l => {
        const linkedPage = pages.find(p => p.id === l.linked_page_id);
        return linkedPage ? {
          id: linkedPage.id,
          title: linkedPage.title,
          slug: linkedPage.slug
        } : null;
      })
      .filter(l => l !== null);
    
    // Related pages
    const relatedPages = links
      .filter(l => l.page_id === page.id && l.link_type === 'related')
      .map(l => {
        const linkedPage = pages.find(p => p.id === l.linked_page_id);
        return linkedPage ? {
          id: linkedPage.id,
          title: linkedPage.title,
          slug: linkedPage.slug
        } : null;
      })
      .filter(l => l !== null);
    
    // Backlinks
    const backlinks = links
      .filter(l => l.linked_page_id === page.id)
      .map(l => {
        const sourcePage = pages.find(p => p.id === l.page_id);
        return sourcePage ? {
          id: sourcePage.id,
          title: sourcePage.title,
          slug: sourcePage.slug,
          link_type: l.link_type
        } : null;
      })
      .filter(l => l !== null);
    
    res.json({
      ...page,
      tags: pageTags,
      inline_links: inlineLinks,
      related_pages: relatedPages,
      backlinks: backlinks
    });
  } catch (error) {
    console.error('[API] Error getting page:', error);
    res.status(500).json({ error: 'Failed to get page' });
  }
});

// POST /api/pages - создать страницу
app.post('/api/pages', (req, res) => {
  try {
    const { title, content_md, tags: inputTags = [], related_page_ids = [] } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const pages = readJSON(PAGES_FILE);
    const tags = readJSON(TAGS_FILE);
    const links = readJSON(LINKS_FILE);
    
    // Проверить дубликат
    const existingPage = pages.find(p => p.title.toLowerCase() === title.toLowerCase());
    if (existingPage) {
      return res.status(400).json({
        error: 'Page with this title already exists',
        existing_slug: existingPage.slug
      });
    }
    
    // Создать страницу
    const newPage = {
      id: pages.length > 0 ? Math.max(...pages.map(p => p.id)) + 1 : 1,
      title,
      slug: generateSlug(title),
      content_md: content_md || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    pages.push(newPage);
    writeJSON(PAGES_FILE, pages);
    
    // Обработать теги
    const contentTags = extractTags(content_md || '');
    const allTags = [...new Set([...inputTags, ...contentTags])];
    
    allTags.forEach(tagName => {
      tags.push({
        page_id: newPage.id,
        name: tagName.toLowerCase()
      });
    });
    writeJSON(TAGS_FILE, tags);
    
    // Обработать вики-ссылки (inline)
    const wikiLinks = extractWikiLinks(content_md || '');
    wikiLinks.forEach(link => {
      const linkedPage = pages.find(p => p.title.toLowerCase() === link.title.toLowerCase());
      if (linkedPage) {
        links.push({
          page_id: newPage.id,
          linked_page_id: linkedPage.id,
          link_type: 'inline'
        });
      }
    });
    
    // Обработать related pages
    related_page_ids.forEach(relatedId => {
      if (pages.find(p => p.id === relatedId)) {
        links.push({
          page_id: newPage.id,
          linked_page_id: relatedId,
          link_type: 'related'
        });
      }
    });
    
    writeJSON(LINKS_FILE, links);
    
    res.status(201).json(newPage);
  } catch (error) {
    console.error('[API] Error creating page:', error);
    res.status(500).json({ error: 'Failed to create page' });
  }
});

// PUT /api/pages/:id - обновить страницу
app.put('/api/pages/:id', (req, res) => {
  try {
    const pageId = parseInt(req.params.id);
    const { title, content_md, tags: inputTags = [], related_page_ids = [] } = req.body;
    
    const pages = readJSON(PAGES_FILE);
    const tags = readJSON(TAGS_FILE);
    const links = readJSON(LINKS_FILE);
    
    const pageIndex = pages.findIndex(p => p.id === pageId);
    
    if (pageIndex === -1) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    // Обновить страницу
    pages[pageIndex] = {
      ...pages[pageIndex],
      title: title || pages[pageIndex].title,
      content_md: content_md !== undefined ? content_md : pages[pageIndex].content_md,
      updated_at: new Date().toISOString()
    };
    
    writeJSON(PAGES_FILE, pages);
    
    // Удалить старые теги
    const newTags = tags.filter(t => t.page_id !== pageId);
    
    // Добавить новые теги
    const contentTags = extractTags(content_md || '');
    const allTags = [...new Set([...inputTags, ...contentTags])];
    
    allTags.forEach(tagName => {
      newTags.push({
        page_id: pageId,
        name: tagName.toLowerCase()
      });
    });
    
    writeJSON(TAGS_FILE, newTags);
    
    // Удалить старые inline и related ссылки
    const newLinks = links.filter(l => l.page_id !== pageId);
    
    // Добавить новые inline ссылки
    const wikiLinks = extractWikiLinks(content_md || '');
    wikiLinks.forEach(link => {
      const linkedPage = pages.find(p => p.title.toLowerCase() === link.title.toLowerCase());
      if (linkedPage) {
        newLinks.push({
          page_id: pageId,
          linked_page_id: linkedPage.id,
          link_type: 'inline'
        });
      }
    });
    
    // Добавить новые related ссылки
    related_page_ids.forEach(relatedId => {
      if (pages.find(p => p.id === relatedId)) {
        newLinks.push({
          page_id: pageId,
          linked_page_id: relatedId,
          link_type: 'related'
        });
      }
    });
    
    writeJSON(LINKS_FILE, newLinks);
    
    res.json(pages[pageIndex]);
  } catch (error) {
    console.error('[API] Error updating page:', error);
    res.status(500).json({ error: 'Failed to update page' });
  }
});

// DELETE /api/pages/:id - удалить страницу
app.delete('/api/pages/:id', (req, res) => {
  try {
    const pageId = parseInt(req.params.id);
    
    const pages = readJSON(PAGES_FILE);
    const tags = readJSON(TAGS_FILE);
    const links = readJSON(LINKS_FILE);
    
    const pageIndex = pages.findIndex(p => p.id === pageId);
    
    if (pageIndex === -1) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    // Удалить страницу
    pages.splice(pageIndex, 1);
    writeJSON(PAGES_FILE, pages);
    
    // Удалить теги
    const newTags = tags.filter(t => t.page_id !== pageId);
    writeJSON(TAGS_FILE, newTags);
    
    // Удалить ссылки
    const newLinks = links.filter(l => l.page_id !== pageId && l.linked_page_id !== pageId);
    writeJSON(LINKS_FILE, newLinks);
    
    res.json({ message: 'Page deleted successfully' });
  } catch (error) {
    console.error('[API] Error deleting page:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

// GET /api/tags - получить все теги
app.get('/api/tags', (req, res) => {
  try {
    const tags = readJSON(TAGS_FILE);
    
    // Подсчитать количество страниц для каждого тега
    const tagCounts = {};
    tags.forEach(t => {
      tagCounts[t.name] = (tagCounts[t.name] || 0) + 1;
    });
    
    const tagsWithCounts = Object.entries(tagCounts).map(([name, count]) => ({
      name,
      pages_count: count
    }));
    
    res.json({ tags: tagsWithCounts, total: tagsWithCounts.length });
  } catch (error) {
    console.error('[API] Error getting tags:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

// GET /api/tags/:name/pages - получить страницы по тегу
app.get('/api/tags/:name/pages', (req, res) => {
  try {
    const tagName = req.params.name.toLowerCase();
    const pages = readJSON(PAGES_FILE);
    const tags = readJSON(TAGS_FILE);
    
    const pageIds = tags.filter(t => t.name === tagName).map(t => t.page_id);
    const tagPages = pages.filter(p => pageIds.includes(p.id));
    
    res.json({ tag: tagName, pages: tagPages, total: tagPages.length });
  } catch (error) {
    console.error('[API] Error getting pages by tag:', error);
    res.status(500).json({ error: 'Failed to get pages by tag' });
  }
});

// GET /api/search - поиск страниц
app.get('/api/search', (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const pages = readJSON(PAGES_FILE);
    const tags = readJSON(TAGS_FILE);
    
    const searchLower = query.toLowerCase();
    
    const results = pages.filter(page => {
      return page.title.toLowerCase().includes(searchLower) ||
             (page.content_md && page.content_md.toLowerCase().includes(searchLower));
    }).map(page => {
      const pageTags = tags.filter(t => t.page_id === page.id).map(t => t.name);
      
      // Создать snippet
      let snippet = '';
      if (page.content_md) {
        const index = page.content_md.toLowerCase().indexOf(searchLower);
        if (index !== -1) {
          const start = Math.max(0, index - 50);
          const end = Math.min(page.content_md.length, index + 150);
          snippet = '...' + page.content_md.substring(start, end) + '...';
        } else {
          snippet = page.content_md.substring(0, 200);
        }
      }
      
      return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        snippet,
        tags: pageTags,
        created_at: page.created_at
      };
    });
    
    res.json({ query, results, total: results.length });
  } catch (error) {
    console.error('[API] Error searching:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// GET /api/stats - статистика
app.get('/api/stats', (req, res) => {
  try {
    const pages = readJSON(PAGES_FILE);
    const tags = readJSON(TAGS_FILE);
    const links = readJSON(LINKS_FILE);
    
    // Подсчитать теги
    const tagCounts = {};
    tags.forEach(t => {
      tagCounts[t.name] = (tagCounts[t.name] || 0) + 1;
    });
    
    // Самые популярные страницы (по backlinks)
    const backlinkCounts = {};
    links.forEach(l => {
      backlinkCounts[l.linked_page_id] = (backlinkCounts[l.linked_page_id] || 0) + 1;
    });
    
    const mostLinkedPages = Object.entries(backlinkCounts)
      .map(([pageId, count]) => {
        const page = pages.find(p => p.id === parseInt(pageId));
        return page ? { ...page, backlinks_count: count } : null;
      })
      .filter(p => p !== null)
      .sort((a, b) => b.backlinks_count - a.backlinks_count)
      .slice(0, 5);
    
    // Самые используемые теги
    const mostUsedTags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, pages_count: count }))
      .sort((a, b) => b.pages_count - a.pages_count)
      .slice(0, 5);
    
    res.json({
      pages_total: pages.length,
      tags_total: Object.keys(tagCounts).length,
      links_total: links.length,
      most_linked_pages: mostLinkedPages,
      most_used_tags: mostUsedTags
    });
  } catch (error) {
    console.error('[API] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Serve index.html for all page routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Laniakea Vault server running on http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`🖼️  Media directory: ${path.join(__dirname, 'media')}`);
});
