/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev10
 *
 * ScheduleEngine.js
 *
 * Этап 6:
 * - grace periods двухкомпонентные (ОД + %);
 * - RATE_CHANGE;
 * - MANUAL_ADJUSTMENT;
 * - PAYMENT_DATE full recalculation;
 * - planned payment change;
 * - RESTRUCTURE.
 * ==========================================================
 */

import LoanState from "../models/LoanState.js";
import PaymentRow from "../models/PaymentRow.js";
import Schedule from "../models/Schedule.js";

import InterestCalculator from "../math/InterestCalculator.js";
import PaymentCalculator from "../math/PaymentCalculator.js";
import PeriodCalculator from "../math/PeriodCalculator.js";

import DateUtils from "../core/DateUtils.js";
import Money from "../core/Money.js";
import {
    RowType,
    PaymentMethod,
    BusinessDayConvention,
    GraceType,
    EventType
} from "../core/Enums.js";

import EventPipelineProcessor from
    "../processors/EventPipelineProcessor.js";

import ManualAdjustmentProcessor from
    "../processors/ManualAdjustmentProcessor.js";

export default class ScheduleEngine {

    constructor(calendar) {

        this.calendar = calendar;

        this.eventPipelineProcessor =
            new EventPipelineProcessor();

        this.manualAdjustmentProcessor =
            new ManualAdjustmentProcessor();

    }

    generate(loan) {

        const state = new LoanState(loan);

        this.addIssueRow(state);

        while (!this.isFinished(state)) {

            this.processNextPeriod(state);

        }

        return new Schedule(state.rows);

    }

    addIssueRow(state) {

        const row = new PaymentRow({

            period: 0,

            paymentDate: DateUtils.clone(
                state.loan.issueDate
            ),

            days: 0,

            openingBalance: state.loan.principal,

            principal: 0,

            interest: 0,

            payment: 0,

            closingBalance: state.loan.principal,

            rowType: RowType.NORMAL,

            metadata: {
                technical: true,
                kind: "ISSUE"
            }

        });

        state.addRow(row);

    }

    processNextPeriod(state) {

        const scheduledPaymentDate =
            this.calculateNextPaymentDate(state);

        const pipeline =
            this.eventPipelineProcessor.process(state);

        let row = this.buildBaseRow(
            state,
            scheduledPaymentDate,
            pipeline
        );

        const manualEvents =
            this.manualAdjustmentProcessor.getEvents(
                state,
                row
            );

        const paymentDateAdjustment =
            this.manualAdjustmentProcessor.getPaymentDateAdjustment(
                manualEvents
            );

        if (paymentDateAdjustment) {

            row = this.rebuildRowWithManualDate(
                state,
                pipeline,
                paymentDateAdjustment.value
            );

        }

        row = this.manualAdjustmentProcessor.applySimpleAdjustments(
            row,
            manualEvents
        );

        if (manualEvents.length > 0) {

            row = this.manualAdjustmentProcessor.markAsManual(
                row
            );

        }

        state.addInterest(row.interest);
        state.addRow(row);

    }

    buildBaseRow(
        state,
        paymentDate,
        pipeline
    ) {

        const period = PeriodCalculator.calculate(
            state.currentDate,
            paymentDate
        );

        const interest = InterestCalculator.calculate(
            state.balance,
            pipeline.effectiveRate,
            period.days
        );

        // Grace period: двухкомпонентная логика (ОД + %)
        const graceDerived = this.deriveGraceType(
            state,
            pipeline
        );

        if (graceDerived.graceType === GraceType.PRINCIPAL) {

            return this.createPaymentRow(
                state,
                paymentDate,
                period,
                interest,
                0,
                interest,
                state.balance,
                RowType.GRACE,
                pipeline
            );

        }

        if (graceDerived.graceType === GraceType.INTEREST) {

            const principal =
                this.calculateStandardPrincipal(
                    state,
                    graceDerived.effectiveInterest,
                    pipeline.effectiveRate,
                    pipeline.plannedPayment,
                    pipeline.effectiveTerm
                );

            return this.createPaymentRow(
                state,
                paymentDate,
                period,
                principal,
                principal,
                0,
                Money.subtract(
                    state.balance,
                    principal
                ),
                RowType.GRACE,
                pipeline
            );

        }

        if (graceDerived.graceType === GraceType.FULL) {

            return this.createPaymentRow(
                state,
                paymentDate,
                period,
                0,
                0,
                0,
                state.balance,
                RowType.GRACE,
                pipeline
            );

        }

        // Standard row (no grace or grace already handled)
        const standardInterest = graceDerived.effectiveInterest;

        const principal =
            this.calculateStandardPrincipal(
                state,
                standardInterest,
                pipeline.effectiveRate,
                pipeline.plannedPayment,
                pipeline.effectiveTerm
            );

        const payment = Money.round(
            principal + standardInterest
        );

        const closing = Money.subtract(
            state.balance,
            principal
        );

        return this.createPaymentRow(
            state,
            paymentDate,
            period,
            principal,
            standardInterest,
            payment,
            closing,
            RowType.NORMAL,
            pipeline
        );

    }

    /**
     * Выводит graceType и effectiveInterest для текущей строки,
     * учитывая GraceEvent и двухкомпонентную льготу.
     */
    deriveGraceType(state, pipeline) {

        const graceEvents = state.loan.getGraceEvents();

        if (graceEvents.length === 0) {

            const interest = InterestCalculator.calculate(
                state.balance,
                pipeline.effectiveRate,
                pipeline.days
            );

            return {
                graceType: GraceType.NONE,
                effectiveInterest: interest
            };

        }

        const firstGrace = graceEvents[0];

        // Определяем номер текущего периода (1-based)
        const currentPeriod = state.rows.length;

        // Льготные диапазоны
        const graceStart = firstGrace.startPeriod;
        const graceEnd = firstGrace.endPeriod;

        const isGracePeriod =
            currentPeriod >= graceStart &&
            currentPeriod <= graceEnd;

        const interest = InterestCalculator.calculate(
            state.balance,
            pipeline.effectiveRate,
            pipeline.days
        );

        if (!isGracePeriod) {

            return {
                graceType: GraceType.NONE,
                effectiveInterest: interest
            };

        }

        // GraceEvent уже содержит graceType (PRINCIPAL, INTEREST, FULL)
        const explicitGraceType = firstGrace.graceType;

        if (explicitGraceType === GraceType.PRINCIPAL) {

            return {
                graceType: GraceType.PRINCIPAL,
                effectiveInterest: interest
            };

        }

        if (explicitGraceType === GraceType.INTEREST) {

            return {
                graceType: GraceType.INTEREST,
                effectiveInterest: 0
            };

        }

        if (explicitGraceType === GraceType.FULL) {

            return {
                graceType: GraceType.FULL,
                effectiveInterest: 0
            };

        }

        // Fallback: если что-то не так, считаем без льготы
        return {
            graceType: GraceType.NONE,
            effectiveInterest: interest
        };

    }

    calculateStandardPrincipal(
        state,
        interest,
        annualRate,
        plannedPayment,
        effectiveTerm
    ) {

        if (
            state.loan.paymentMethod ===
            PaymentMethod.ANNUITY
        ) {

            return PaymentCalculator.annuityPrincipal(
                state.balance,
                annualRate,
                interest,
                effectiveTerm
            );

        }

        return PaymentCalculator.equalPrincipal(
            state.balance,
            state.loan.term,
            effectiveTerm
        );

    }

    createPaymentRow(
        state,
        paymentDate,
        period,
        principal,
        interest,
        payment,
        closingBalance,
        rowType,
        pipeline
    ) {

        const metadata = {
            graceType: pipeline.graceType,
            effectiveRate: pipeline.effectiveRate,
            plannedPayment: pipeline.plannedPayment
        };

        return new PaymentRow({

            period: state.rows.length,

            paymentDate: DateUtils.clone(paymentDate),

            days: period.days,

            openingBalance: state.balance,

            principal: Money.round(principal),

            interest: Money.round(interest),

            payment: Money.round(payment),

            closingBalance: Money.round(closingBalance),

            rowType,

            metadata

        });

    }

    calculateNextPaymentDate(
        state
    ) {

        const term = state.loan.term;
        const issueDate = state.loan.issueDate;
        const firstPaymentDate = state.loan.firstPaymentDate;

        const periodIndex = state.rows.length;

        if (periodIndex === 1) {

            return DateUtils.clone(firstPaymentDate);

        }

        const first = DateUtils.addMonths(
            issueDate,
            1
        );

        // Прибавляем (periodIndex - 1) месяцев к firstPaymentDate
        const next = DateUtils.addMonths(
            firstPaymentDate,
            periodIndex - 1
        );

        return next;

    }

    isFinished(state) {

        const term = state.loan.term;

        const numberOfPayments =
            state.rows.length - 1;

        return numberOfPayments >= term;

    }

    rebuildRowWithManualDate(
        state,
        pipeline,
        manualDate
    ) {

        const period = PeriodCalculator.calculate(
            state.currentDate,
            manualDate
        );

        const interest = InterestCalculator.calculate(
            state.balance,
            pipeline.effectiveRate,
            period.days
        );

        const graceDerived = this.deriveGraceType(
            state,
            pipeline
        );

        if (graceDerived.graceType === GraceType.PRINCIPAL) {

            return this.createPaymentRow(
                state,
                manualDate,
                period,
                interest,
                0,
                interest,
                state.balance,
                RowType.GRACE,
                pipeline
            );

        }

        if (graceDerived.graceType === GraceType.INTEREST) {

            const principal =
                this.calculateStandardPrincipal(
                    state,
                    graceDerived.effectiveInterest,
                    pipeline.effectiveRate,
                    pipeline.plannedPayment,
                    pipeline.effectiveTerm
                );

            return this.createPaymentRow(
                state,
                manualDate,
                period,
                principal,
                principal,
                0,
                Money.subtract(
                    state.balance,
                    principal
                ),
                RowType.GRACE,
                pipeline
            );

        }

        if (graceDerived.graceType === GraceType.FULL) {

            return this.createPaymentRow(
                state,
                manualDate,
                period,
                0,
                0,
                0,
                state.balance,
                RowType.GRACE,
                pipeline
            );

        }

        const standardInterest = graceDerived.effectiveInterest;

        const principal =
            this.calculateStandardPrincipal(
                state,
                standardInterest,
                pipeline.effectiveRate,
                pipeline.plannedPayment,
                pipeline.effectiveTerm
            );

        const payment = Money.round(
            principal + standardInterest
        );

        const closing = Money.subtract(
            state.balance,
            principal
        );

        return this.createPaymentRow(
            state,
            manualDate,
            period,
            principal,
            standardInterest,
            payment,
            closing,
            RowType.NORMAL,
            pipeline
        );

    }

}