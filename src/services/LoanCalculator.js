/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * LoanCalculator.js
 *
 * Верхнеуровневый сервис:
 * loan -> schedule -> cash flows -> APR
 * ==========================================================
 */

import ScheduleEngine from "../engine/ScheduleEngine.js";
import CashFlowBuilder from "../builders/CashFlowBuilder.js";
import APRCalculator from "../math/APRCalculator.js";
import { APR } from "../core/Constants.js";

export default class LoanCalculator {

    constructor(calendar = null) {

        this.calendar = calendar;

        this.scheduleEngine = new ScheduleEngine(
            calendar
        );

    }

    /**
     * Выполнить полный расчет кредита:
     * - график
     * - cash-flow
     * - ГЭСВ / APR
     *
     * options = {
     *   fees: [
     *     { date, amount, description?, metadata? }
     *   ],
     *   apr: {
     *     basisDays?,
     *     guess?,
     *     tolerance?,
     *     maxIterations?
     *   }
     * }
     */
    calculate(
        loan,
        options = {}
    ) {

        const schedule =
            this.scheduleEngine.generate(
                loan
            );

        const fees = Array.isArray(options.fees)
            ? options.fees
            : [];

        const cashFlows =
            CashFlowBuilder.fromLoanAndSchedule(
                loan,
                schedule,
                {
                    fees
                }
            );

        const aprOptions = {
            basisDays:
                options.apr &&
                Number.isFinite(options.apr.basisDays)
                    ? options.apr.basisDays
                    : APR.BASIS_DAYS,

            guess:
                options.apr &&
                Number.isFinite(options.apr.guess)
                    ? options.apr.guess
                    : undefined,

            tolerance:
                options.apr &&
                Number.isFinite(options.apr.tolerance)
                    ? options.apr.tolerance
                    : undefined,

            maxIterations:
                options.apr &&
                Number.isInteger(options.apr.maxIterations)
                    ? options.apr.maxIterations
                    : undefined
        };

        const apr =
            APRCalculator.calculate(
                cashFlows,
                aprOptions
            );

        return {
            loan,
            schedule,
            cashFlows,
            apr
        };

    }

}