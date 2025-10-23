// API endpoints
const API = {
  data: '/api/data',
  themes: '/api/themes',
  stats: '/api/stats'
};

// State
let allData = [];
let allThemes = [];
let currentView = 'grid';

// Init
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadStats();
  loadData();
  loadThemes();
  initModal();
  initFilters();
});

// Navigation
function initNavigation() {
  const buttons = document.querySelectorAll('nav button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
      
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${view}-view`).classList.add('active');
}

// Load stats
async function loadStats() {
  try {
    const res = await fetch(API.stats);
    const stats = await res.json();
    document.getElementById('total-data').textContent = `${stats.totalData} датумов`;
    document.getElementById('total-themes').textContent = `${stats.totalThemes} тем`;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Load data
async function loadData() {
  try {
    const res = await fetch(API.data);
    allData = await res.json();
    renderDataGrid(allData);
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

// Render data grid
function renderDataGrid(data) {
  const grid = document.getElementById('data-grid');
  
  if (data.length === 0) {
    grid.innerHTML = '<p>Нет датумов</p>';
    return;
  }
  
  grid.innerHTML = data.map(datum => {
    const icon = datum.type === 'image' ? '📷' : datum.type === 'video' ? '📹' : '📝';
    const imgSrc = datum.type === 'image' ? `/media/${datum.file_path}` : '';
    const note = datum.note || 'Без описания';
    const themes = datum.themes ? datum.themes.split(', ') : [];
    
    return `
      <div class="data-card" data-id="${datum.id}">
        ${imgSrc ? `<img src="${imgSrc}" alt="">` : ''}
        <div class="data-card-body">
          <div class="data-card-type">${icon} ${datum.type}</div>
          <div class="data-card-note">${note}</div>
          <div class="data-card-themes">
            ${themes.map(t => `<span class="theme-tag">#${t}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  grid.querySelectorAll('.data-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      showDatum(id);
    });
  });
}

// Load themes
async function loadThemes() {
  try {
    const res = await fetch(API.themes);
    allThemes = await res.json();
    renderThemes(allThemes);
  } catch (err) {
    console.error('Error loading themes:', err);
  }
}

// Render themes
function renderThemes(themes) {
  const list = document.getElementById('themes-list');
  
  if (themes.length === 0) {
    list.innerHTML = '<p>Нет тем</p>';
    return;
  }
  
  list.innerHTML = themes.map(theme => `
    <div class="theme-card" data-theme="${theme.name}">
      <div class="theme-card-name">#${theme.name}</div>
      <div class="theme-card-count">${theme.count} датумов</div>
    </div>
  `).join('');
  
  // Add click handlers
  list.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const themeName = card.dataset.theme;
      filterByTheme(themeName);
    });
  });
}

// Filter by theme
function filterByTheme(themeName) {
  const filtered = allData.filter(d => 
    d.themes && d.themes.split(', ').includes(themeName)
  );
  switchView('grid');
  renderDataGrid(filtered);
}

// Show datum in modal
function showDatum(id) {
  const datum = allData.find(d => d.id == id);
  if (!datum) return;
  
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  
  const icon = datum.type === 'image' ? '📷' : datum.type === 'video' ? '📹' : '📝';
  const imgSrc = datum.type === 'image' ? `/media/${datum.file_path}` : '';
  const note = datum.note || 'Без описания';
  const themes = datum.themes ? datum.themes.split(', ') : [];
  const date = new Date(datum.created_at).toLocaleString('ru-RU');
  
  body.innerHTML = `
    ${imgSrc ? `<img src="${imgSrc}" alt="">` : ''}
    <div class="modal-note">${note}</div>
    <div class="modal-themes">
      ${themes.map(t => `<span class="theme-tag">#${t}</span>`).join('')}
    </div>
    <div class="modal-meta">
      ${icon} ${datum.type} • ID: ${datum.id} • ${date}
    </div>
  `;
  
  modal.classList.add('active');
}

// Init modal
function initModal() {
  const modal = document.getElementById('modal');
  const close = modal.querySelector('.close');
  
  close.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
}

// Init filters
function initFilters() {
  const search = document.getElementById('search');
  const filterType = document.getElementById('filter-type');
  
  search.addEventListener('input', applyFilters);
  filterType.addEventListener('change', applyFilters);
}

function applyFilters() {
  const searchText = document.getElementById('search').value.toLowerCase();
  const filterType = document.getElementById('filter-type').value;
  
  let filtered = allData;
  
  if (searchText) {
    filtered = filtered.filter(d => 
      (d.note && d.note.toLowerCase().includes(searchText)) ||
      (d.themes && d.themes.toLowerCase().includes(searchText))
    );
  }
  
  if (filterType) {
    filtered = filtered.filter(d => d.type === filterType);
  }
  
  renderDataGrid(filtered);
}
