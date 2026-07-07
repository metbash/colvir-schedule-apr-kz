/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev2
 *
 * KazakhstanHolidayProvider.js
 *
 * Поставщик праздничных дней Казахстана.
 *
 * Этап 3:
 * - поддержка фиксированного набора праздничных дней;
 * - подготовка к расширению по производственному календарю;
 * - используется для переноса платежей на рабочие дни.
 *
 * Важно:
 * На текущем этапе включены основные даты.
 * При необходимости переносы рабочих дней и точные
 * ежегодные переносы можно расширить отдельной таблицей.
 * ==========================================================
 */

import HolidayProvider from "./HolidayProvider.js";

export default class KazakhstanHolidayProvider extends HolidayProvider {

    constructor() {

        super();

        this.holidays = new Set([

            "2026-01-01",
            "2026-01-02",
            "2026-01-07",
            "2026-03-08",
            "2026-03-21",
            "2026-03-22",
            "2026-03-23",
            "2026-05-01",
            "2026-05-07",
            "2026-05-09",
            "2026-07-06",
            "2026-08-30",
            "2026-12-16"

        ]);

    }

    /**
     * Проверка праздничного дня.
     *
     * @param {Date} date
     * @returns {boolean}
     */
    isHoliday(date) {

        const key = this.toKey(date);

        return this.holidays.has(key);

    }

    /**
     * Преобразовать дату в YYYY-MM-DD.
     *
     * @param {Date} date
     * @returns {string}
     */
    toKey(date) {

        const year = date.getFullYear();

        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;

    }

}