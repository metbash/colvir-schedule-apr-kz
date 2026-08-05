/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev2
 *
 * APRCalculator.js
 *
 * ГЭСВ (Годовая Эффективная Ставка Вознаграждения) по
 * Правилам НБРК (Постановление №87 от 26.03.2018).
 *
 * Формула:
 *   P_net = Σ S_k / (1 + GESV)^(D_k / 365)
 *
 * где:
 *   P_net  — сумма займа за вычетом комиссий в дату выдачи
 *   S_k    — k-й платёж (основной долг + проценты + комиссии)
 *   D_k    — количество календарных дней от даты выдачи до k-го платежа
 *   GESV   — искомая ГЭСВ (decimal, не %)
 *   basis  — 365 дней (Act/365, фиксировано НБРК)
 *
 * Решается методом Ньютона–Рафсона.
 * ==========================================================
 */

import CashFlowSet from "../models/CashFlowSet.js";
import APRResult from "../models/APRResult.js";
import DateUtils from "../core/DateUtils.js";
import Validation from "../core/Validation.js";
import { APR } from "../core/Constants.js";

export default class APRCalculator {

    /**
     * Рассчитать ГЭСВ.
     *
     * @param {CashFlowSet} cashFlowSet  — набор cash-flow:
     *   положительные = выдача займа (нетто, после вычета комиссий в дату выдачи),
     *   отрицательные = платежи заёмщика (погашение + проценты + комиссии).
     *
     * @param {object} options
     * @param {number} [options.basisDays=365]   — база (НБРК = 365)
     * @param {number} [options.guess=0.30]      — начальное приближение
     * @param {number} [options.tolerance]       — точность
     * @param {number} [options.maxIterations]   — макс. итераций
     *
     * @returns {APRResult}
     */
    static calculate(
        cashFlowSet,
        options = {}
    ) {

        if (!(cashFlowSet instanceof CashFlowSet)) {
            throw new TypeError(
                "cashFlowSet must be CashFlowSet."
            );
        }

        if (cashFlowSet.length === 0) {
            throw new Error(
                "cashFlowSet is empty."
            );
        }

        if (!cashFlowSet.hasMixedSigns()) {
            throw new Error(
                "cashFlowSet must contain both positive and negative flows."
            );
        }

        const basisDays =
            options.basisDays || APR.BASIS_DAYS;

        Validation.requirePositive(
            "basisDays",
            basisDays
        );

        const guess =
            typeof options.guess === "number"
                ? options.guess
                : 0.30;

        const tolerance =
            typeof options.tolerance === "number"
                ? options.tolerance
                : APR.EPSILON;

        const maxIterations =
            Number.isInteger(options.maxIterations)
                ? options.maxIterations
                : APR.MAX_ITERATIONS;

        const flows = cashFlowSet
            .sorted()
            .toArray();

        const baseDate = flows[0].date;

        let rate = guess;
        let converged = false;
        let residual = null;
        let iterations = 0;

        for (let i = 0; i < maxIterations; i++) {

            iterations = i + 1;

            const f = APRCalculator.npv(
                flows,
                rate,
                baseDate,
                basisDays
            );

            const df = APRCalculator.npvDerivative(
                flows,
                rate,
                baseDate,
                basisDays
            );

            residual = f;

            if (Math.abs(f) < tolerance) {
                converged = true;
                break;
            }

            if (Math.abs(df) < tolerance) {
                break;
            }

            const nextRate = rate - f / df;

            if (!Number.isFinite(nextRate)) {
                break;
            }

            if (nextRate <= -0.9999999999) {
                break;
            }

            rate = nextRate;

        }

        return new APRResult({
            annualRate: rate,
            annualPercentRate: rate * 100,
            converged,
            iterations,
            residual: residual ?? 0,
            basisDays,
            metadata: {
                baseDate,
                method: "NEWTON_RAPHSON"
            }
        });

    }

    /**
     * NPV при заданной ставке.
     *
     * NPV = Σ flow.amount / (1 + rate)^(days / basisDays)
     *
     * При сходимости NPV → 0.
     */
    static npv(
        flows,
        annualRate,
        baseDate,
        basisDays
    ) {

        return flows.reduce((sum, flow) => {

            const days = DateUtils.daysBetween(
                baseDate,
                flow.date
            );

            const exponent = days / basisDays;

            return (
                sum +
                flow.amount /
                    Math.pow(
                        1 + annualRate,
                        exponent
                    )
            );

        }, 0);

    }

    /**
     * Производная NPV по ставке (для Newton-Raphson).
     *
     * d(NPV)/d(rate) = Σ flow.amount * (-exponent) / (1 + rate)^(exponent + 1)
     */
    static npvDerivative(
        flows,
        annualRate,
        baseDate,
        basisDays
    ) {

        return flows.reduce((sum, flow) => {

            const days = DateUtils.daysBetween(
                baseDate,
                flow.date
            );

            const exponent = days / basisDays;

            if (exponent === 0) {
                return sum;
            }

            return (
                sum +
                flow.amount *
                    (
                        -exponent /
                        Math.pow(
                            1 + annualRate,
                            exponent + 1
                        )
                    )
            );

        }, 0);

    }

}
