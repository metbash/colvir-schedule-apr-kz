/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * APRCalculator.js
 *
 * Первая рабочая версия APR / ГЭСВ калькулятора
 * на базе реальных cash-flow и дат.
 * ==========================================================
 */

import CashFlowSet from "../models/CashFlowSet.js";
import APRResult from "../models/APRResult.js";
import DateUtils from "../core/DateUtils.js";
import Validation from "../core/Validation.js";
import { APR } from "../core/Constants.js";

export default class APRCalculator {

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
            options.basisDays || 365;

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

            const f = this.npv(
                flows,
                rate,
                baseDate,
                basisDays
            );

            const df = this.npvDerivative(
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