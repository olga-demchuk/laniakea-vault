// API базовый URL
const API_URL = '/api';

// Глобальное состояние
const state = {
  pages: [],
  tags: [],
  currentPage: null,
  currentView: 'home'
};

// Роутинг
const router = {
  init() {
    window.addEventListener('popstate', () => this.handleRoute());
    this.handleRoute();
  },
  
  navigate(path) {
    history.pushState({}, '', path);
    this.handleRoute();
  },
  
  handleRoute() {
    const path = window.location.pathname;
    
    if (path === '/' || path === '/home') {
      showHome();
    } else if (path === '/tags') {
      showTags();
    } else if (path.startsWith('/page/')) {
      const slug = path.replace('/page/', '');
      showPage(slug);
    } else if (path === '/new') {
      showEditor();
    } else if (path.startsWith('/edit/')) {
      const id = parseInt(path.replace('/edit/', ''));
      showEditor(id);
    } else {
      showHome();
    }
  }
};

// API calls
const api = {
  async getPages() {
    const response = await fetch(`${API_URL}/pages`);
    return response.json();
  },
  
  async getPage(slug) {
    const response = await fetch(`${API_URL}/pages/${slug}`);
    if (!response.ok) throw new Error('Page not found');
    return response.json();
  },
  
  async createPage(data) {
    const response = await fetch(`${API_URL}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  async updatePage(id, data) {
    const response = await fetch(`${API_URL}/pages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  async deletePage(id) {
    const response = await fetch(`${API_URL}/pages/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },
  
  async getTags() {
    const response = await fetch(`${API_URL}/tags`);
    return response.json();
  },
  
  async getTagPages(tagName) {
    const response = await fetch(`${API_URL}/tags/${tagName}/pages`);
    return response.json();
  },
  
  async search(query) {
    const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
    return response.json();
  },
  
  async getStats() {
    const response = await fetch(`${API_URL}/stats`);
    return response.json();
  }
};

// Render functions
function render(html) {
  document.getElementById('app').innerHTML = html;
}

function showLoading() {
  render('<div class="loading">Загрузка...</div>');
}

function showError(message) {
  render(`<div class="error">${message}</div>`);
}

// Home view
async function showHome() {
  state.currentView = 'home';
  updateNav();
  showLoading();
  
  try {
    const data = await api.getPages();
    state.pages = data.pages;
    
    if (state.pages.length === 0) {
      render(`
        <div class="empty-state">
          <h3>База знаний пуста</h3>
          <p>Создайте первую страницу, чтобы начать собирать знания</p>
          <button onclick="router.navigate('/new')" class="btn-primary" style="margin-top: 20px;">Создать страницу</button>
        </div>
      `);
      return;
    }
    
    // Сортировка по дате обновления
    const sortedPages = [...state.pages].sort((a, b) => 
      new Date(b.updated_at) - new Date(a.updated_at)
    );
    
    const pagesHTML = sortedPages.map(page => `
      <div class="page-card" onclick="router.navigate('/page/${page.slug}')">
        <h3>${escapeHtml(page.title)}</h3>
        <div class="meta">
          Обновлено: ${formatDate(page.updated_at)} • 
          Ссылок: ${page.links_count} • 
          Упоминаний: ${page.backlinks_count}
        </div>
        <div class="tags">
          ${page.tags.map(tag => `<span class="tag" onclick="event.stopPropagation(); router.navigate('/tags'); filterByTag('${tag}')">#${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
    `).join('');
    
    render(`
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${state.pages.length}</div>
          <div class="stat-label">Страниц</div>
        </div>
      </div>
      <h2 style="margin-bottom: 20px;">Все страницы</h2>
      <div class="pages-list">
        ${pagesHTML}
      </div>
    `);
  } catch (error) {
    console.error('Error loading pages:', error);
    showError('Ошибка загрузки страниц');
  }
}

// Tags view
async function showTags() {
  state.currentView = 'tags';
  updateNav();
  showLoading();
  
  try {
    const data = await api.getTags();
    state.tags = data.tags;
    
    if (state.tags.length === 0) {
      render(`
        <div class="empty-state">
          <h3>Теги не найдены</h3>
          <p>Добавьте теги к страницам, чтобы они появились здесь</p>
        </div>
      `);
      return;
    }
    
    const sortedTags = [...state.tags].sort((a, b) => b.pages_count - a.pages_count);
    
    const tagsHTML = sortedTags.map(tag => `
      <div class="tag-card" onclick="showTagPages('${tag.name}')">
        <div class="tag-name">#${escapeHtml(tag.name)}</div>
        <div class="tag-count">${tag.pages_count} ${pluralize(tag.pages_count, 'страница', 'страницы', 'страниц')}</div>
      </div>
    `).join('');
    
    render(`
      <h2 style="margin-bottom: 20px;">Все теги</h2>
      <div class="tags-grid">
        ${tagsHTML}
      </div>
      <div id="tag-pages" style="margin-top: 30px;"></div>
    `);
  } catch (error) {
    console.error('Error loading tags:', error);
    showError('Ошибка загрузки тегов');
  }
}

async function showTagPages(tagName) {
  try {
    const data = await api.getTagPages(tagName);
    
    const pagesHTML = data.pages.map(page => `
      <div class="page-card" onclick="router.navigate('/page/${page.slug}')">
        <h3>${escapeHtml(page.title)}</h3>
        <div class="meta">
          Обновлено: ${formatDate(page.updated_at)}
        </div>
      </div>
    `).join('');
    
    document.getElementById('tag-pages').innerHTML = `
      <h3 style="margin-bottom: 15px;">Страницы с тегом #${escapeHtml(tagName)}</h3>
      <div class="pages-list">
        ${pagesHTML}
      </div>
    `;
  } catch (error) {
    console.error('Error loading tag pages:', error);
  }
}

// Page view
async function showPage(slug) {
  showLoading();
  
  try {
    const page = await api.getPage(slug);
    state.currentPage = page;
    
    // Render markdown with wiki links
    const contentHtml = marked.parse(page.content_md || '');
    
    const tagsHTML = page.tags.length > 0 ? `
      <div class="tags">
        ${page.tags.map(tag => `<span class="tag" onclick="router.navigate('/tags'); filterByTag('${tag.name}')">#${escapeHtml(tag.name)}</span>`).join('')}
      </div>
    ` : '';
    
    const relatedHTML = page.related_pages && page.related_pages.length > 0 ? `
      <div class="page-section">
        <h3>См. также</h3>
        <div class="related-list">
          ${page.related_pages.map(p => `
            <div class="related-item">
              <a href="/page/${p.slug}" onclick="event.preventDefault(); router.navigate('/page/${p.slug}')">${escapeHtml(p.title)}</a>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';
    
    const backlinksHTML = page.backlinks && page.backlinks.length > 0 ? `
      <div class="page-section">
        <h3>Обратные ссылки</h3>
        <div class="backlinks-list">
          ${page.backlinks.map(p => `
            <div class="backlink-item">
              <a href="/page/${p.slug}" onclick="event.preventDefault(); router.navigate('/page/${p.slug}')">${escapeHtml(p.title)}</a>
              <span style="color: #7f8c8d; font-size: 12px; margin-left: 8px;">(${p.link_type})</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';
    
    render(`
      <div class="page-view">
        <div class="page-header">
          <h1 class="page-title">${escapeHtml(page.title)}</h1>
          <div class="page-meta">
            <span>Создано: ${formatDate(page.created_at)}</span>
            <span>Обновлено: ${formatDate(page.updated_at)}</span>
          </div>
          ${tagsHTML}
          <div class="page-actions">
            <button onclick="router.navigate('/edit/${page.id}')" class="btn-primary">Редактировать</button>
            <button onclick="deletePage(${page.id})" class="btn-danger">Удалить</button>
            <button onclick="router.navigate('/')" class="btn-secondary">Назад</button>
          </div>
        </div>
        
        <div class="page-content">
          ${contentHtml}
        </div>
        
        ${relatedHTML}
        ${backlinksHTML}
      </div>
    `);
    
    // Обработка вики-ссылок после рендера
    processWikiLinks();
  } catch (error) {
    console.error('Error loading page:', error);
    
    // Проверка создания новой страницы
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('create') === 'true') {
      const title = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      showEditor(null, title);
    } else {
      showError('Страница не найдена');
    }
  }
}

// Process wiki links in rendered content
function processWikiLinks() {
  const content = document.querySelector('.page-content');
  if (!content) return;
  
  // Заменить [[...]] на ссылки
  content.innerHTML = content.innerHTML.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (match, title, displayText) => {
      const linkTitle = title.trim();
      const linkText = displayText ? displayText.trim() : linkTitle;
      const slug = generateSlug(linkTitle);
      
      // Проверить существует ли страница
      const pageExists = state.pages.some(p => p.title.toLowerCase() === linkTitle.toLowerCase());
      
      if (pageExists) {
        const page = state.pages.find(p => p.title.toLowerCase() === linkTitle.toLowerCase());
        return `<a href="/page/${page.slug}" class="wiki-link" onclick="event.preventDefault(); router.navigate('/page/${page.slug}')">${escapeHtml(linkText)}</a>`;
      } else {
        return `<a href="/page/${slug}?create=true" class="wiki-link-missing" onclick="event.preventDefault(); router.navigate('/page/${slug}?create=true')">${escapeHtml(linkText)}</a>`;
      }
    }
  );
}

// Editor view
async function showEditor(pageId = null, prefillTitle = '') {
  showLoading();
  
  let page = null;
  if (pageId) {
    try {
      // Найти страницу по ID
      const pagesData = await api.getPages();
      page = pagesData.pages.find(p => p.id === pageId);
      if (page) {
        // Получить полные данные страницы
        page = await api.getPage(page.slug);
      }
    } catch (error) {
      console.error('Error loading page for edit:', error);
    }
  }
  
  const title = page ? page.title : prefillTitle;
  const content = page ? page.content_md : '';
  const tags = page && page.tags ? page.tags.map(t => t.name).join(', ') : '';
  
  render(`
    <div class="editor-container">
      <div class="editor-left">
        <h2>${page ? 'Редактировать страницу' : 'Новая страница'}</h2>
        
        <div class="form-group">
          <label>Название</label>
          <input type="text" id="page-title" value="${escapeHtml(title)}" placeholder="Например: Гликолевая кислота">
        </div>
        
        <div class="form-group">
          <label>Содержимое (Markdown)</label>
          <textarea id="page-content" placeholder="Начните писать... Используйте [[Название]] для ссылок на другие страницы и #тег для тегов">${escapeHtml(content)}</textarea>
        </div>
        
        <div class="form-group">
          <label>Теги (через запятую)</label>
          <input type="text" id="page-tags" value="${escapeHtml(tags)}" placeholder="косметология, кислоты, anti-age">
        </div>
        
        <div class="editor-actions">
          <button onclick="savePage(${pageId})" class="btn-primary">Сохранить</button>
          <button onclick="router.navigate('${page ? '/page/' + page.slug : '/'}')" class="btn-secondary">Отмена</button>
        </div>
      </div>
      
      <div class="editor-right">
        <div class="preview">
          <h4>Предпросмотр</h4>
          <div id="preview-content"></div>
        </div>
      </div>
    </div>
  `);
  
  // Live preview
  const contentTextarea = document.getElementById('page-content');
  const previewDiv = document.getElementById('preview-content');
  
  function updatePreview() {
    const markdown = contentTextarea.value;
    previewDiv.innerHTML = marked.parse(markdown);
  }
  
  contentTextarea.addEventListener('input', updatePreview);
  updatePreview();
}

async function savePage(pageId) {
  const title = document.getElementById('page-title').value.trim();
  const content_md = document.getElementById('page-content').value;
  const tagsInput = document.getElementById('page-tags').value;
  
  if (!title) {
    alert('Пожалуйста, введите название страницы');
    return;
  }
  
  const tags = tagsInput
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
  
  const data = {
    title,
    content_md,
    tags,
    related_page_ids: [] // TODO: добавить UI для related pages
  };
  
  try {
    if (pageId) {
      const result = await api.updatePage(pageId, data);
      router.navigate(`/page/${result.slug}`);
    } else {
      const result = await api.createPage(data);
      router.navigate(`/page/${result.slug}`);
    }
  } catch (error) {
    console.error('Error saving page:', error);
    alert('Ошибка при сохранении страницы');
  }
}

async function deletePage(pageId) {
  if (!confirm('Вы уверены, что хотите удалить эту страницу?')) {
    return;
  }
  
  try {
    await api.deletePage(pageId);
    router.navigate('/');
  } catch (error) {
    console.error('Error deleting page:', error);
    alert('Ошибка при удалении страницы');
  }
}

// Search
let searchTimeout;
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
      if (state.currentView === 'home') showHome();
      return;
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        const data = await api.search(query);
        
        const resultsHTML = data.results.map(page => `
          <div class="page-card" onclick="router.navigate('/page/${page.slug}')">
            <h3>${escapeHtml(page.title)}</h3>
            <div class="meta">
              ${escapeHtml(page.snippet)}
            </div>
            <div class="tags">
              ${page.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>
        `).join('');
        
        render(`
          <h2 style="margin-bottom: 20px;">Результаты поиска: "${escapeHtml(query)}"</h2>
          <div class="pages-list">
            ${resultsHTML || '<div class="empty-state"><p>Ничего не найдено</p></div>'}
          </div>
        `);
      } catch (error) {
        console.error('Error searching:', error);
      }
    }, 300);
  });
});

// Nav buttons
document.getElementById('home-btn').addEventListener('click', () => {
  router.navigate('/');
});

document.getElementById('tags-btn').addEventListener('click', () => {
  router.navigate('/tags');
});

document.getElementById('new-page-btn').addEventListener('click', () => {
  router.navigate('/new');
});

function updateNav() {
  const homeBtn = document.getElementById('home-btn');
  const tagsBtn = document.getElementById('tags-btn');
  
  homeBtn.classList.toggle('active', state.currentView === 'home');
  tagsBtn.classList.toggle('active', state.currentView === 'tags');
}

// Helper functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function pluralize(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
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
  slug = slug.split('').map(char => translitMap[char] || char).join('');
  slug = slug.replace(/[^a-z0-9\s-]/g, '');
  slug = slug.replace(/\s+/g, '-');
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-+|-+$/g, '');
  
  return slug;
}

function filterByTag(tagName) {
  // This function is called when clicking a tag
  showTagPages(tagName);
}

// Initialize router
router.init();
