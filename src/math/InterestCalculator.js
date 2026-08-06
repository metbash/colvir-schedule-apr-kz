/**
 * ==========================================================
 * InterestCalculator
 *
 * Colvir convention: 30/360
 *
 * interest = balance * annualRate / 100 * days30_360 / 360
 *
 * days must be computed via DateUtils.days30_360().
 * ==========================================================
 */

import Money from "../core/Money.js";

export default class InterestCalculator {

    /**
     * Расчет процентов (конвенция Colvir 30/360).
     *
     * @param {number} balance
     * @param {number} annualRate  — % годовых (например, 20, не 0.20)
     * @param {number} days        — количество дней по конвенции 30/360
     *
     * @returns {number}
     */
    static calculate(

        balance,

        annualRate,

        days

    ) {

        const interest =

            balance

            *

            annualRate

            /

            100

            *

            days

            /

            360;

        return Money.round(

            interest

        );

    }

}
