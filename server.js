require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER_ID = parseInt(process.env.ALLOWED_USER_ID);

const MEDIA_DIRS = ['media/images', 'media/videos', 'media/texts'];
MEDIA_DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const db = new sqlite3.Database('./laniakea.db', (err) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err);
  } else {
    console.log('✅ БД подключена');
    initDB();
  }
});

function initDB() {
  db.run(`
    CREATE TABLE IF NOT EXISTS data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      file_path TEXT,
      content TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS data_themes (
      data_id INTEGER,
      theme_id INTEGER,
      FOREIGN KEY(data_id) REFERENCES data(id),
      FOREIGN KEY(theme_id) REFERENCES themes(id),
      PRIMARY KEY(data_id, theme_id)
    )
  `, (err) => {
    if (err) {
      console.error('Ошибка создания таблиц:', err);
    } else {
      console.log('✅ Таблицы готовы');
    }
  });
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Бот запущен');

function checkAccess(msg) {
  if (msg.from.id !== ALLOWED_USER_ID) {
    bot.sendMessage(msg.chat.id, '❌ У тебя нет доступа к этому боту');
    return false;
  }
  return true;
}

function extractHashtags(text) {
  if (!text) return [];
  const hashtags = text.match(/#[а-яА-ЯёЁa-zA-Z0-9_]+/g) || [];
  return hashtags.map(tag => tag.substring(1).toLowerCase());
}

function saveThemes(dataId, hashtags, callback) {
  if (hashtags.length === 0) {
    callback();
    return;
  }
  
  let processed = 0;
  
  hashtags.forEach(tag => {
    db.run('INSERT OR IGNORE INTO themes (name) VALUES (?)', [tag], function() {
      db.get('SELECT id FROM themes WHERE name = ?', [tag], (err, row) => {
        if (row) {
          db.run('INSERT OR IGNORE INTO data_themes (data_id, theme_id) VALUES (?, ?)', 
            [dataId, row.id], () => {
              processed++;
              if (processed === hashtags.length) callback();
            });
        }
      });
    });
  });
}

bot.onText(/\/start/, (msg) => {
  if (!checkAccess(msg)) return;
  
  bot.sendMessage(msg.chat.id, `
🏠 *Laniakea Vault*

Отправь мне:
📷 Фото — сохраню как image
📝 Текст — сохраню как markdown

Хештеги станут темами:
#ванная #хранение Баночки для ванной

Команды:
/list — последние 5 датумов
/themes — все темы
/theme ванная — датумы по теме
/stats — статистика
  `, { parse_mode: 'Markdown' });
});

bot.on('photo', async (msg) => {
  if (!checkAccess(msg)) return;
  
  const chatId = msg.chat.id;
  const photo = msg.photo[msg.photo.length - 1];
  const caption = msg.caption || 'Без описания';
  const hashtags = extractHashtags(caption);
  
  try {
    const file = await bot.getFile(photo.file_id);
    const fileName = `img_${Date.now()}.jpg`;
    const filePath = path.join('media/images', fileName);
    
    await bot.downloadFile(file.file_id, 'media/images');
    
    db.run(
      'INSERT INTO data (type, file_path, note) VALUES (?, ?, ?)',
      ['image', filePath, caption],
      function(err) {
        if (err) {
          bot.sendMessage(chatId, '❌ Ошибка сохранения в БД');
          console.error(err);
        } else {
          const dataId = this.lastID;
          
          saveThemes(dataId, hashtags, () => {
            const themesText = hashtags.length > 0 ? `\n🏷️ Темы: ${hashtags.join(', ')}` : '';
            bot.sendMessage(chatId, `✅ Сохранено!\n\n📷 ID: ${dataId}\n📝 ${caption}${themesText}`);
          });
        }
      }
    );
  } catch (err) {
    bot.sendMessage(chatId, '❌ Ошибка загрузки фото');
    console.error(err);
  }
});

bot.on('message', (msg) => {
  if (!checkAccess(msg)) return;
  
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!text || text.startsWith('/') || msg.photo) return;
  
  const hashtags = extractHashtags(text);
  const fileName = `text_${Date.now()}.md`;
  const filePath = path.join('media/texts', fileName);
  
  fs.writeFileSync(filePath, text, 'utf8');
  
  db.run(
    'INSERT INTO data (type, file_path, content) VALUES (?, ?, ?)',
    ['text', filePath, text],
    function(err) {
      if (err) {
        bot.sendMessage(chatId, '❌ Ошибка сохранения в БД');
        console.error(err);
      } else {
        const dataId = this.lastID;
        
        saveThemes(dataId, hashtags, () => {
          const preview = text.substring(0, 100);
          const themesText = hashtags.length > 0 ? `\n🏷️ Темы: ${hashtags.join(', ')}` : '';
          bot.sendMessage(chatId, `✅ Текст сохранён!\n\n📝 ID: ${dataId}\n\n${preview}${text.length > 100 ? '...' : ''}${themesText}`);
        });
      }
    }
  );
});

bot.onText(/\/list/, (msg) => {
  if (!checkAccess(msg)) return;
  
  const chatId = msg.chat.id;
  
  db.all(
    'SELECT * FROM data ORDER BY created_at DESC LIMIT 5',
    [],
    (err, rows) => {
      if (err) {
        bot.sendMessage(chatId, '❌ Ошибка чтения БД');
        console.error(err);
        return;
      }
      
      if (rows.length === 0) {
        bot.sendMessage(chatId, 'Пока ничего не сохранено');
        return;
      }
      
      let message = '📚 *Последние датумы:*\n\n';
      
      rows.forEach(row => {
        const icon = row.type === 'image' ? '📷' : '📝';
        const preview = row.note || row.content?.substring(0, 50) || 'Без описания';
        message += `${icon} ID ${row.id}: ${preview}\n`;
        message += `   📅 ${new Date(row.created_at).toLocaleString('ru-RU')}\n\n`;
      });
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  );
});

bot.onText(/\/themes/, (msg) => {
  if (!checkAccess(msg)) return;
  
  const chatId = msg.chat.id;
  
  db.all(
    `SELECT themes.name, COUNT(data_themes.data_id) as count 
     FROM themes 
     LEFT JOIN data_themes ON themes.id = data_themes.theme_id 
     GROUP BY themes.id 
     ORDER BY count DESC, themes.name`,
    [],
    (err, rows) => {
      if (err) {
        bot.sendMessage(chatId, '❌ Ошибка чтения БД');
        console.error(err);
        return;
      }
      
      if (rows.length === 0) {
        bot.sendMessage(chatId, 'Пока нет тем');
        return;
      }
      
      let message = '🏷️ *Все темы:*\n\n';
      
      rows.forEach(row => {
        message += `#${row.name} (${row.count})\n`;
      });
      
      message += '\nИспользуй: /theme название';
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  );
});

bot.onText(/\/theme (.+)/, (msg, match) => {
  if (!checkAccess(msg)) return;
  
  const chatId = msg.chat.id;
  const themeName = match[1].toLowerCase().replace('#', '');
  
  db.all(
    `SELECT data.* FROM data
     JOIN data_themes ON data.id = data_themes.data_id
     JOIN themes ON data_themes.theme_id = themes.id
     WHERE themes.name = ?
     ORDER BY data.created_at DESC`,
    [themeName],
    (err, rows) => {
      if (err) {
        bot.sendMessage(chatId, '❌ Ошибка чтения БД');
        console.error(err);
        return;
      }
      
      if (rows.length === 0) {
        bot.sendMessage(chatId, `Нет датумов с темой #${themeName}`);
        return;
      }
      
      let message = `🏷️ *Тема: #${themeName}*\n\nНайдено: ${rows.length}\n\n`;
      
      rows.slice(0, 10).forEach(row => {
        const icon = row.type === 'image' ? '📷' : '📝';
        const preview = row.note || row.content?.substring(0, 50) || 'Без описания';
        message += `${icon} ID ${row.id}: ${preview}\n`;
      });
      
      if (rows.length > 10) {
        message += `\n... и ещё ${rows.length - 10}`;
      }
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  );
});

bot.onText(/\/stats/, (msg) => {
  if (!checkAccess(msg)) return;
  
  const chatId = msg.chat.id;
  
  db.get('SELECT COUNT(*) as total FROM data', [], (err, dataRow) => {
    if (err) {
      bot.sendMessage(chatId, '❌ Ошибка чтения БД');
      return;
    }
    
    db.get('SELECT COUNT(*) as total FROM themes', [], (err, themeRow) => {
      if (err) {
        bot.sendMessage(chatId, '❌ Ошибка чтения БД');
        return;
      }
      
      bot.sendMessage(chatId, 
        `📊 *Статистика*\n\nВсего датумов: ${dataRow.total}\nВсего тем: ${themeRow.total}`, 
        { parse_mode: 'Markdown' });
    });
  });
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

process.on('SIGINT', () => {
  db.close();
  bot.stopPolling();
  console.log('\n👋 Бот остановлен');
  process.exit(0);
});
