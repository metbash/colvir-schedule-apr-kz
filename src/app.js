/**
 * app.js — точка входа UI.
 * Всю логику UI (обработчики событий, рендер таблицы, экспорт)
 * нужно перенести сюда из index.html в рамках v5.
 *
 * TODO v5:
 *   - Перенести inline <script> из index.html сюда
 *   - Подключить CalendarMode и KazakhstanCalendar
 *   - Добавить переключатель режима праздников в UI
 */

import KazakhstanCalendar from './calendar/KazakhstanCalendar.js';
import { CalendarMode } from './core/CalendarMode.js';

// Экспортируем для использования в index.html до полного переноса UI
export { KazakhstanCalendar, CalendarMode };

console.log('[v5] app.js загружен. CalendarMode:', CalendarMode);
