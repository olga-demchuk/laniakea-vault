# Laniakea Vault

Локальная база знаний для хранения идей, референсов и заметок по темам.

## Возможности

- 📱 Telegram-бот для быстрого добавления контента
- 🗂️ Организация по темам (tags)
- 📷 Поддержка изображений, видео и текста
- 💾 Локальное хранение (SQLite + файлы)
- 🔍 Поиск и фильтрация

## Структура
```
laniakea-vault/
├── media/           # Медиафайлы
│   ├── images/
│   ├── videos/
│   └── texts/
├── laniakea.db      # База данных
├── server.js        # Telegram бот
└── .env             # Настройки (не в Git)
```

## Установка

1. Клонировать репозиторий
```bash
git clone https://github.com/olga-demchuk/laniakea-vault.git
cd laniakea-vault
```

2. Установить зависимости
```bash
npm install
```

3. Создать `.env` на основе `.env.example`
```bash
cp .env.example .env
```

4. Заполнить `.env` своими данными:
   - `TELEGRAM_BOT_TOKEN` — токен от @BotFather
   - `ALLOWED_USER_ID` — твой Telegram User ID

5. Запустить
```bash
node server.js
```

## Использование

### Telegram-бот команды:

- Отправь изображение/видео/текст — добавится в базу
- `/themes` — список всех тем
- `/theme название` — показать датумы по теме
- `/stats` — статистика
- `/help` — помощь

### Добавление контента:

1. Отправь медиа боту
2. Бот спросит описание
3. Введи теги через #: `#food #highprotein`
4. Готово!

## Технологии

- Node.js
- SQLite3
- Telegram Bot API

## Roadmap

- [ ] Веб-интерфейс для просмотра и редактирования
- [ ] Связи между датумами
- [ ] Экспорт в Notion/Markdown
- [ ] Полнотекстовый поиск
- [ ] Автотеги через AI

## Лицензия

Private project

---

**Laniakea** — проект о привычках, порядке и здравом смысле.
