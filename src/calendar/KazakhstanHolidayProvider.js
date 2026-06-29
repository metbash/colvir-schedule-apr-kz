/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * KazakhstanHolidayProvider.js
 *
 * Поставщик праздничных дней Казахстана.
 * Пока содержит только интерфейс.
 * Позже будет подключена база праздников
 * и переносов рабочих дней.
 * ==========================================================
 */

import HolidayProvider from "./HolidayProvider.js";

export default class KazakhstanHolidayProvider extends HolidayProvider {

    constructor() {

        super();

    }

    /**
     * Проверка праздничного дня.
     *
     * Пока возвращает false.
     * На следующем этапе будет использовать
     * производственный календарь Казахстана.
     *
     * @param {Date} date
     * @returns {boolean}
     */
    isHoliday(date) {

        return false;

    }

}