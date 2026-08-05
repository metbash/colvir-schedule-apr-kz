/**
 * ==========================================================
 * InterestCalculator
 *
 * Colvir convention: basis = 360 / 1.05 ≈ 342.857
 *
 * interest = balance * annualRate / 100 * days / BASIS
 *          = balance * annualRate / 100 * days * 1.05 / 360
 * ==========================================================
 */

import Money from "../core/Money.js";

/**
 * Colvir day-count basis: 360 / 1.05 ≈ 342.857
 * Applied consistently to both interest accrual and PMT discounting.
 */
export const COLVIR_BASIS = 360 / 1.05;

export default class InterestCalculator {

    /**
     * Расчет процентов (конвенция Colvir).
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

            COLVIR_BASIS;

        return Money.round(

            interest

        );

    }

}
