/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev3
 *
 * PaymentCalculator.js
 *
 * Расчет платежей.
 * ==========================================================
 */

import Money from "../core/Money.js";
import DateUtils from "../core/DateUtils.js";

export default class PaymentCalculator {

    /**
     * Аннуитетный платеж.
     *
     * Методология Colvir: PMT рассчитывается через дисконтирование
     * по конвенции 30/360 с фактическими датами платежей.
     *
     * Каждый платёж дисконтируется по накопленному произведению
     * периодных ставок: r_i = annualRate/100/360 * days30_360(prevDate, paymentDate)
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

        // С датами: 30/360 дисконтирование (основной путь)
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
     * PMT через аналитическое дисконтирование 30/360.
     *
     * dailyRate = annualRate / 100 / 360
     * cumulativeFactor_i = prod_{j=1}^{i} (1 + dailyRate * days30_360_j)
     * PMT = principal / sum(1 / cumulativeFactor_i)
     *
     * @private
     */
    static _calculateAnnuityBy30_360(principal, annualRate, dates) {

        const dailyRate = annualRate / 100 / 360;

        const discountFactors = [];
        let cumFactor = 1.0;

        for (let i = 1; i < dates.length; i++) {
            const d = DateUtils.days30_360(dates[i - 1], dates[i]);
            cumFactor *= (1 + dailyRate * d);
            discountFactors.push(cumFactor);
        }

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
