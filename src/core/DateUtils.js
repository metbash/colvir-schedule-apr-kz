/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * DateUtils.js
 *
 * Общие операции с датами.
 * Не содержит банковой логики.
 * ==========================================================
 */

export default class DateUtils {

    /**
     * Клонирование даты.
     *
     * @param {Date} date
     * @returns {Date}
     */
    static clone(date) {

        return new Date(date.getTime());

    }

    /**
     * Сравнение дат без учета времени.
     *
     * @param {Date} a
     * @param {Date} b
     * @returns {boolean}
     */
    static equals(a, b) {

        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );

    }

    /**
     * Возвращает true если первая дата меньше второй.
     */
    static lessThan(a, b) {

        return a.getTime() < b.getTime();

    }

    /**
     * Возвращает true если первая дата больше второй.
     */
    static greaterThan(a, b) {

        return a.getTime() > b.getTime();

    }

    /**
     * Количество календарных дней между датами (Act/Act).
     *
     * Используется для отображения колонки "Дней" в графике
     * и для расчёта процентов по равным долям.
     */
    static daysBetween(startDate, endDate) {

        const start = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate()
        );

        const end = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate()
        );

        const millisecondsPerDay = 24 * 60 * 60 * 1000;

        return Math.round(

            (end.getTime() - start.getTime()) / millisecondsPerDay

        );

    }

    /**
     * Количество дней по конвенции 30/360 (European 30/360, ISDA).
     *
     * Используется для расчёта процентов и PMT аннуитета — совпадает
     * с методологией Colvir.
     *
     * Правило:
     *   d1 = min(startDate.day, 30)
     *   d2 = если d1 >= 30, то min(endDate.day, 30), иначе endDate.day
     *   days = 360*(Y2-Y1) + 30*(M2-M1) + (d2-d1)
     *
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {number}
     */
    static days30_360(startDate, endDate) {

        const y1 = startDate.getFullYear();
        const m1 = startDate.getMonth() + 1;
        const day1 = startDate.getDate();

        const y2 = endDate.getFullYear();
        const m2 = endDate.getMonth() + 1;
        const day2Raw = endDate.getDate();

        const d1 = Math.min(day1, 30);
        const d2 = d1 >= 30 ? Math.min(day2Raw, 30) : day2Raw;

        return 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);

    }

    /**
     * Добавить дни.
     */
    static addDays(date, days) {

        const result = DateUtils.clone(date);

        result.setDate(result.getDate() + days);

        return result;

    }

    /**
     * Добавить месяцы.
     *
     * Если число отсутствует в новом месяце,
     * используется последний день месяца.
     */
    static addMonths(date, months) {

        const result = DateUtils.clone(date);

        const originalDay = result.getDate();

        result.setDate(1);

        result.setMonth(result.getMonth() + months);

        const lastDay = new Date(

            result.getFullYear(),

            result.getMonth() + 1,

            0

        ).getDate();

        result.setDate(

            Math.min(originalDay, lastDay)

        );

        return result;

    }

    /**
     * Последний день месяца.
     */
    static endOfMonth(date) {

        return new Date(

            date.getFullYear(),

            date.getMonth() + 1,

            0

        );

    }

    /**
     * Первый день месяца.
     */
    static startOfMonth(date) {

        return new Date(

            date.getFullYear(),

            date.getMonth(),

            1

        );

    }

    /**
     * Проверка високосного года.
     */
    static isLeapYear(year) {

        return (
            year % 400 === 0 ||
            (year % 4 === 0 && year % 100 !== 0)
        );

    }

}
