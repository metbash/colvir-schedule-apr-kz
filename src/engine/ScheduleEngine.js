/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev9
 *
 * ScheduleEngine.js
 *
 * Этап 5:
 * - grace periods;
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
    GraceType
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

        if (pipeline.graceType === GraceType.PRINCIPAL) {

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

        if (pipeline.graceType === GraceType.INTEREST) {

            const principal =
                this.calculateStandardPrincipal(
                    state,
                    interest,
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

        if (pipeline.graceType === GraceType.FULL) {

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

        const payment = this.calculatePayment(
            state,
            interest,
            pipeline.effectiveRate,
            pipeline.plannedPayment,
            pipeline.effectiveTerm
        );

        const principal = this.calculatePrincipal(
            state,
            payment,
            interest
        );

        const closingBalance =
            this.calculateClosingBalance(
                state,
                principal
            );

        const rowType =
            pipeline.restructureEvent
                ? RowType.RESTRUCTURED
                : RowType.NORMAL;

        return this.createPaymentRow(
            state,
            paymentDate,
            period,
            payment,
            principal,
            interest,
            closingBalance,
            rowType,
            pipeline
        );

    }

    rebuildRowWithManualDate(
        state,
        pipeline,
        manualDateValue
    ) {

        const manualDate = manualDateValue instanceof Date
            ? manualDateValue
            : new Date(manualDateValue);

        const adjustedPaymentDate =
            this.adjustPaymentDate(manualDate);

        return this.buildBaseRow(
            state,
            adjustedPaymentDate,
            pipeline
        );

    }

    createPaymentRow(
        state,
        paymentDate,
        period,
        payment,
        principal,
        interest,
        closingBalance,
        rowType = RowType.NORMAL,
        pipeline = null
    ) {

        return new PaymentRow({

            period: state.period + 1,

            paymentDate: DateUtils.clone(paymentDate),

            days: period.days,

            openingBalance: state.balance,

            principal,

            interest,

            payment,

            closingBalance,

            rowType,

            metadata: {
                effectiveRate: state.effectiveRate,
                effectiveTerm: state.effectiveTerm,
                plannedPayment: state.plannedPayment,
                restructureApplied: Boolean(
                    pipeline &&
                    pipeline.restructureEvent
                )
            }

        });

    }

    calculatePayment(
        state,
        interest,
        effectiveRate,
        plannedPayment = null,
        effectiveTerm = null
    ) {

        if (this.isLastPayment(state, effectiveTerm)) {

            return Money.add(
                state.balance,
                interest
            );

        }

        if (
            plannedPayment !== null &&
            state.loan.paymentMethod ===
                PaymentMethod.ANNUITY
        ) {

            return Money.round(
                plannedPayment
            );

        }

        switch (state.loan.paymentMethod) {

            case PaymentMethod.ANNUITY:

                return PaymentCalculator.calculateAnnuity(
                    state.balance,
                    effectiveRate,
                    this.getRemainingPeriods(
                        state,
                        effectiveTerm
                    )
                );

            case PaymentMethod.EQUAL_PRINCIPAL: {

                const remainingPeriods =
                    this.getRemainingPeriods(
                        state,
                        effectiveTerm
                    );

                const principalPart =
                    PaymentCalculator.calculateEqualPrincipal(
                        state.balance,
                        remainingPeriods
                    );

                return Money.add(
                    principalPart,
                    interest
                );

            }

            default:
                throw new Error(
                    "Unknown payment method."
                );

        }

    }

    calculateStandardPrincipal(
        state,
        interest,
        effectiveRate = null,
        plannedPayment = null,
        effectiveTerm = null
    ) {

        if (this.isLastPayment(state, effectiveTerm)) {
            return Money.round(state.balance);
        }

        const payment = this.calculatePayment(
            state,
            interest,
            effectiveRate ?? state.effectiveRate,
            plannedPayment ?? state.plannedPayment,
            effectiveTerm ?? state.effectiveTerm
        );

        let principal = Money.subtract(
            payment,
            interest
        );

        if (principal < 0) {
            principal = 0;
        }

        if (principal > state.balance) {
            principal = state.balance;
        }

        return Money.round(principal);

    }

    calculatePrincipal(
        state,
        payment,
        interest
    ) {

        if (this.isLastPayment(state, state.effectiveTerm)) {
            return Money.round(state.balance);
        }

        let principal = Money.subtract(
            payment,
            interest
        );

        if (principal < 0) {
            principal = 0;
        }

        if (principal > state.balance) {
            principal = state.balance;
        }

        return Money.round(principal);

    }

    calculateClosingBalance(state, principal) {

        if (this.isLastPayment(state, state.effectiveTerm)) {
            return 0;
        }

        return Money.subtract(
            state.balance,
            principal
        );

    }

    getRemainingPeriods(
        state,
        effectiveTerm = null
    ) {

        const term =
            effectiveTerm ?? state.effectiveTerm;

        return term - state.period;

    }

    calculateNextPaymentDate(state) {

        let paymentDate;

        if (state.period === 0) {

            paymentDate = DateUtils.clone(
                state.loan.firstPaymentDate
            );

        } else {

            paymentDate = DateUtils.addMonths(
                state.loan.firstPaymentDate,
                state.period
            );

        }

        return this.adjustPaymentDate(
            paymentDate
        );

    }

    adjustPaymentDate(paymentDate) {

        if (
            this.calendar &&
            typeof this.calendar.adjustDate === "function"
        ) {

            return this.calendar.adjustDate(
                paymentDate,
                BusinessDayConvention.FOLLOWING
            );

        }

        return paymentDate;

    }

    isFinished(
        state,
        effectiveTerm = null
    ) {

        const term =
            effectiveTerm ?? state.effectiveTerm;

        if (state.period >= term) {
            return true;
        }

        if (
            state.period > 0 &&
            Money.isZero(state.balance)
        ) {
            return true;
        }

        return false;

    }

    isLastPayment(
        state,
        effectiveTerm = null
    ) {

        const term =
            effectiveTerm ?? state.effectiveTerm;

        return state.period + 1 >= term;

    }

}