/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * PeriodCalculator.js
 *
 * Расчет параметров периода.
 * ==========================================================
 */

import DateUtils from "../core/DateUtils.js";

export default class PeriodCalculator {

    /**
     * Рассчитать параметры периода.
     *
     * @param {Date} fromDate
     * @param {Date} toDate
     * @returns {Object}
     */
    static calculate(fromDate, toDate) {

        const days = DateUtils.daysBetween(
            fromDate,
            toDate
        );

        return {

            fromDate,

            toDate,

            days

        };

    }

}