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
import DateUtils from "../core/DateUtils.js";
import { COLVIR_BASIS } from "./InterestCalculator.js";

export default class PaymentCalculator {

    /**
     * Аннуитетный платеж.
     *
     * Методология Colvir: PMT рассчитывается через дисконтирование
     * по конвенции 30/360 с фактическими датами платежей.
     *
     * Каждый платёж дисконтируется по накопленному произведению
     * периодных ставок: r_i = annualRate / COLVIR_BASIS * days30_360(prevDate, paymentDate)
     *
     * PV = sum( PMT / prod(1 + r_i) ) = principal  => решаем относительно PMT.
     *
     * Если даты не переданы — используется стандартная формула rate/12.
     *
     * @param {number}   principal
     * @param {number}   annualRate  — % годовых (21, не 0.21)
     * @param {number}   periods     — количество периодов
     * @param {Date[]}   [dates]     — массив дат [issueDate, pay1, pay2, ..., payN]
     *                                 длина должна быть periods + 1
     * @returns {number}
     */
    static calculateAnnuity(
        principal,
        annualRate,
        periods,
        dates = null
    ) {

        if (annualRate === 0) {
            return Money.round(principal / periods);
        }

        // С датами: 30/360 дисконтирование с Colvir basis (основной путь)
        if (dates && dates.length === periods + 1) {

            return PaymentCalculator._calculateAnnuityBy30_360(
                principal,
                annualRate,
                dates
            );

        }

        // Без дат: стандартная формула (fallback)
        const monthlyRate = annualRate / 100 / 12;
        const factor = Math.pow(1 + monthlyRate, periods);
        const payment = principal * monthlyRate * factor / (factor - 1);
        return Money.round(payment);

    }

    /**
     * PMT через аналитическое дисконтирование с Colvir basis.
     *
     * dailyRate = annualRate / 100 / COLVIR_BASIS
     * cumulativeFactor_i = prod_{j=1}^{i} (1 + dailyRate * days30_360_j)
     * PMT = principal / sum(1 / cumulativeFactor_i)
     *
     * @private
     */
    static _calculateAnnuityBy30_360(principal, annualRate, dates) {

        const dailyRate = annualRate / 100 / COLVIR_BASIS;

        // Накопленные факторы дисконтирования для каждого периода
        const discountFactors = [];
        let cumFactor = 1.0;

        for (let i = 1; i < dates.length; i++) {
            const d = DateUtils.days30_360(dates[i - 1], dates[i]);
            cumFactor *= (1 + dailyRate * d);
            discountFactors.push(cumFactor);
        }

        // PV(PMT) = PMT * sum(1 / factor_i) = principal
        // PMT = principal / sum(1 / factor_i)
        const sumInvFactors = discountFactors.reduce((s, f) => s + 1 / f, 0);
        const payment = principal / sumInvFactors;

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
