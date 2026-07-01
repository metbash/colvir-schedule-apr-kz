/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * PaymentCalculator.js
 *
 * Расчет платежей.
 * ==========================================================
 */

import Money from "../core/Money.js";

export default class PaymentCalculator {

    /**
     * Аннуитетный платеж.
     *
     * @param {number} principal
     * @param {number} annualRate
     * @param {number} periods
     * @returns {number}
     */
    static calculateAnnuity(
        principal,
        annualRate,
        periods
    ) {

        if (annualRate === 0) {

            return Money.round(
                principal / periods
            );

        }

        const monthlyRate =
            annualRate / 100 / 12;

        const factor =
            Math.pow(
                1 + monthlyRate,
                periods
            );

        const payment =
            principal *
            monthlyRate *
            factor /
            (factor - 1);

        return Money.round(payment);

    }

    /**
     * Погашение равными долями.
     *
     * @param {number} principal
     * @param {number} periods
     * @returns {number}
     */
    static calculateEqualPrincipal(
        principal,
        periods
    ) {

        return Money.round(
            principal / periods
        );

    }

}