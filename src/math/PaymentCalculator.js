/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev4
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
     * Аннуитетный PMT с учётом льготного периода (odGrace).
     *
     * Алгоритм Colvir:
     *   1. Льготные платежи (только проценты) дисконтируются к дате выдачи.
     *   2. Из PV вычитается их приведённая стоимость → pv_remaining.
     *   3. PMT = pv_remaining / Σ(1/df_j) для нельготных периодов j.
     *
     * Это даёт точное совпадение с Colvir (например, 1 132 484.97).
     *
     * @param {number}   principal    — сумма кредита
     * @param {number}   annualRate   — % годовых (23, не 0.23)
     * @param {Date[]}   dates        — [issueDate, pay1, ..., payN], длина N+1
     * @param {Object[]} gracePeriods — массив GracePeriod (с .includes(p), .odGrace)
     * @returns {number}
     */
    static calculateAnnuityWithGrace(
        principal,
        annualRate,
        dates,
        gracePeriods
    ) {

        if (annualRate === 0) {
            const totalPeriods = dates.length - 1;
            const normalCount = Array.from(
                { length: totalPeriods },
                (_, i) => i + 1
            ).filter(
                p => !gracePeriods.some(g => g && g.includes && g.includes(p))
            ).length;
            return Money.round(principal / normalCount);
        }

        const dailyRate = annualRate / 100 / 360;
        const totalPeriods = dates.length - 1;

        let cumFactor = 1.0;
        let pvGrace   = 0;
        const normalInvFactors = [];

        for (let i = 1; i <= totalPeriods; i++) {
            const d = DateUtils.days30_360(dates[i - 1], dates[i]);
            cumFactor *= (1 + dailyRate * d);

            const inGrace = gracePeriods.some(
                g => g && typeof g.includes === "function" && g.includes(i)
            );

            if (inGrace) {
                // Дисконтируем льготный процентный платёж
                const interest = principal * dailyRate * d;
                pvGrace += interest / cumFactor;
            } else {
                normalInvFactors.push(1 / cumFactor);
            }
        }

        const sumInv   = normalInvFactors.reduce((s, f) => s + f, 0);
        const pvRemain = principal - pvGrace;

        return Money.round(pvRemain / sumInv);

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
