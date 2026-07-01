/**
 * ==========================================================
 * InterestCalculator
 *
 * Actual/360
 * ==========================================================
 */

import Money from "../core/Money.js";

export default class InterestCalculator {

    /**
     * Расчет процентов.
     *
     * @param {number} balance
     * @param {number} annualRate
     * @param {number} days
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