/**
 * KazakhstanCalendar — календарь выходных и праздников РК.
 *
 * Поддерживает два режима (CalendarMode):
 *   COLVIR  — фиксированный список без переносов (как в Colvir)
 *   ACTUAL  — актуальные даты с учётом постановлений Правительства РК
 *
 * Данные хранятся в src/data/holidays.json.
 */

import holidaysData from '../data/holidays.json';
import { CalendarMode } from '../core/CalendarMode.js';

export default class KazakhstanCalendar {

    /**
     * @param {string} mode — CalendarMode.COLVIR | CalendarMode.ACTUAL
     */
    constructor(mode = CalendarMode.COLVIR) {
        this.mode = mode;
        this._holidaySetCache = {};
    }

    /**
     * Является ли дата нерабочей (выходной или праздник).
     * @param {Date} date
     * @returns {boolean}
     */
    isNonWorking(date) {
        const dow = date.getDay();
        if (dow === 0 || dow === 6) return true;
        return this._isHoliday(date);
    }

    /**
     * Скорректировать дату платежа: если нерабочая — сдвинуть на следующий рабочий день.
     * @param {Date} date
     * @returns {Date}
     */
    adjustPaymentDate(date) {
        let d = new Date(date);
        while (this.isNonWorking(d)) {
            d.setDate(d.getDate() + 1);
        }
        return d;
    }

    // ─── Внутренние методы ────────────────────────────────────────────────────

    _isHoliday(date) {
        if (this.mode === CalendarMode.COLVIR) {
            return this._isHolidayColvir(date);
        } else {
            return this._isHolidayActual(date);
        }
    }

    _isHolidayColvir(date) {
        const m = date.getMonth() + 1;
        const d = date.getDate();
        return holidaysData.colvir.fixed.some(h => h.month === m && h.day === d);
    }

    _isHolidayActual(date) {
        const year = date.getFullYear().toString();
        const yearData = holidaysData.actual[year];
        if (!yearData) {
            // Если данных за год нет — fallback на режим Colvir
            console.warn(`KazakhstanCalendar: нет данных для ${year} в режиме ACTUAL, используется COLVIR`);
            return this._isHolidayColvir(date);
        }

        // Кэшируем Set для быстрого поиска
        if (!this._holidaySetCache[year]) {
            this._holidaySetCache[year] = new Set(yearData.holidays);
            // Добавляем даты переносов (сами перенесённые даты — нерабочие)
            if (yearData.transfers) {
                yearData.transfers.forEach(t => this._holidaySetCache[year].add(t.from));
            }
        }

        const iso = _toISODate(date);
        return this._holidaySetCache[year].has(iso);
    }

    /**
     * Получить название праздника (для tooltip / UI).
     * @param {Date} date
     * @returns {string|null}
     */
    getHolidayName(date) {
        if (this.mode === CalendarMode.COLVIR) {
            const m = date.getMonth() + 1;
            const d = date.getDate();
            const h = holidaysData.colvir.fixed.find(h => h.month === m && h.day === d);
            return h ? h.name : null;
        } else {
            const year = date.getFullYear().toString();
            const yearData = holidaysData.actual[year];
            if (!yearData) return null;
            const iso = _toISODate(date);
            if (yearData.holidays.includes(iso)) {
                // Найти перенос
                const transfer = yearData.transfers && yearData.transfers.find(t => t.from === iso);
                if (transfer) return transfer.note;
                // Найти в colvir.fixed по месяцу/дню как подсказку
                const m = date.getMonth() + 1;
                const d = date.getDate();
                const h = holidaysData.colvir.fixed.find(h => h.month === m && h.day === d);
                return h ? h.name : 'Праздничный день';
            }
            return null;
        }
    }
}

function _toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
