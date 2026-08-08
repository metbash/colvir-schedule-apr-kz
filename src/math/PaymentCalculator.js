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
     * Алгоритм Colvir (реверс-инжиниринг по XLS-графикам):
     *
     *   Colvir НЕ дисконтирует льготные платежи к дате выдачи.
     *   Вместо этого он рассматривает дату конца отсрочки как
     *   «виртуальную дату выдачи» и считает обычный аннуитет
     *   для оставшихся нормальных периодов:
     *
     *     PMT = _calculateAnnuityBy30_360(
     *               principal,
     *               rate,
     *               [graceEndDate, P(grace+1), ..., P(N)]
     *           )
     *
     *   Это даёт точное совпадение с Colvir (например, 1 132 484.97
     *   для: 37.5M, 23%, 59 мес., grace 1-6).
     *
     * Предполагается что все grace-периоды идут подряд в начале.
     * Если grace-периоды не в начале или несмежные — метод корректно
     * обрабатывает только contiguous grace в начале (стандартный случай Colvir).
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

        const totalPeriods = dates.length - 1;

        if (annualRate === 0) {
            const normalCount = Array.from(
                { length: totalPeriods },
                (_, i) => i + 1
            ).filter(
                p => !gracePeriods.some(g => g && g.includes && g.includes(p))
            ).length;
            return Money.round(principal / (normalCount || 1));
        }

        // Найти последний grace-период с odGrace
        let graceEndIdx = 0;
        for (let i = 1; i <= totalPeriods; i++) {
            const inOdGrace = gracePeriods.some(
                g => g && g.odGrace && typeof g.includes === "function" && g.includes(i)
            );
            if (inOdGrace) {
                graceEndIdx = i;
            }
        }

        // Срез дат от конца grace до конца кредита:
        // [dates[graceEndIdx], dates[graceEndIdx+1], ..., dates[N]]
        // = (N - graceEndIdx + 1) элементов → (N - graceEndIdx) периодов
        const subDates = dates.slice(graceEndIdx);

        return PaymentCalculator._calculateAnnuityBy30_360(
            principal,
            annualRate,
            subDates
        );

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
