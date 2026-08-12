# Colvir Schedule & APR Calculator (KZ)

## Версии

| Ветка   | Описание |
|---------|----------|
| `dev-v4` | Текущая стабильная версия (ES modules, без bundler) |
| `v5`     | Новая версия: Vite + разделённые файлы + JSON праздники |

## v5 — Разработка

### Установка

```bash
npm install
```

### Запуск dev-сервера

```bash
npm run dev
```

### Сборка (без сервера, открывать dist/index.html напрямую)

```bash
npm run build
```

### Структура

```
src/
  app.js                  — точка входа UI
  styles.css              — стили
  core/
    CalendarMode.js       — enum режимов праздников
  calendar/
    KazakhstanCalendar.js — логика праздников (COLVIR / ACTUAL)
  data/
    holidays.json         — праздники РК (Colvir + актуальные по постановлениям)
  engine/
    ScheduleEngine.js
  math/
    ...
  models/
    ...
```

### Режимы праздников

- **Как в Colvir** (`CalendarMode.COLVIR`) — фиксированный список, без переносов
- **По постановлениям** (`CalendarMode.ACTUAL`) — актуальные даты с переносами.
  Обновлять `src/data/holidays.json` ежегодно после выхода постановления Правительства РК (обычно октябрь–ноябрь).
