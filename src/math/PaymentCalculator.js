/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev5
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
     * @param {number}   principal
     * @param {number}   annualRate  — % годовых (21, не 0.21)
     * @param {number}   periods     — количество периодов
     * @param {Date[]}   [dates]     — массив дат [issueDate, pay1, pay2, ..., payN]
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

        if (dates && dates.length === periods + 1) {
            return PaymentCalculator._calculateAnnuityBy30_360(
                principal,
                annualRate,
                dates
            );
        }

        const monthlyRate = annualRate / 100 / 12;
        const factor = Math.pow(1 + monthlyRate, periods);
        const payment = principal * monthlyRate * factor / (factor - 1);
        return Money.round(payment);

    }

    /**
     * Аннуитетный PMT с учётом отсрочного периода (odGrace).
     *
     * Алгоритм Colvir: дата окончания отсрочки — «виртуальная дата выдачи»:
     *   PMT = _calculateAnnuityBy30_360(
     *             principal,
     *             rate,
     *             [graceEndDate, P(grace+1), ..., P(N)]
     *         )
     *
     * @param {number}   principal    — текущий баланс или сумма кредита
     * @param {number}   annualRate   — % годовых
     * @param {Date[]}   allDates     — полный массив [issueDate, pay1, ..., payN]
     * @param {Object[]} gracePeriods — массив GracePeriod
     * @param {number}   [startPeriod=1] — номер периода, с которого начинается
     *                                 пересчёт PMT (для несмежных grace).
     *                                 При startPeriod=1 поведение как раньше.
     * @returns {number}
     */
    static calculateAnnuityWithGrace(
        principal,
        annualRate,
        allDates,
        gracePeriods,
        startPeriod = 1
    ) {

        const totalPeriods = allDates.length - 1;

        if (annualRate === 0) {
            const normalCount = Array.from(
                { length: totalPeriods - startPeriod + 1 },
                (_, i) => i + startPeriod
            ).filter(
                p => !gracePeriods.some(g => g && g.includes && g.includes(p))
            ).length;
            return Money.round(principal / (normalCount || 1));
        }

        // Найти последний odGrace-период среди периодов [startPeriod..N]
        let graceEndIdx = startPeriod - 1; // индекс в allDates
        for (let i = startPeriod; i <= totalPeriods; i++) {
            const inOdGrace = gracePeriods.some(
                g => g && g.odGrace && typeof g.includes === "function" && g.includes(i)
            );
            if (inOdGrace) {
                graceEndIdx = i;
            } else {
                // При несмежных grace останавливаемся на первой нормальной группе
                break;
            }
        }

        // Срез дат от конца grace-серии до конца графика
        const subDates = allDates.slice(graceEndIdx);

        return PaymentCalculator._calculateAnnuityBy30_360(
            principal,
            annualRate,
            subDates
        );

    }

    /**
     * PMT через аналитическое дисконтирование 30/360.
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
