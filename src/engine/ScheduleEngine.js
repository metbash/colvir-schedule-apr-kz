/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev6
 *
 * ScheduleEngine.js
 *
 * Этап 4:
 * - grace periods;
 * - RATE_CHANGE;
 * - MANUAL_ADJUSTMENT.
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

        const paymentDate = this.calculateNextPaymentDate(state);

        const period = PeriodCalculator.calculate(
            state.currentDate,
            paymentDate
        );

        const pipeline =
            this.eventPipelineProcessor.process(state);

        const interest = InterestCalculator.calculate(
            state.balance,
            pipeline.effectiveRate,
            period.days
        );

        let row;

        if (pipeline.graceType === GraceType.PRINCIPAL) {

            row = this.createPaymentRow(
                state,
                paymentDate,
                period,
                interest,
                0,
                interest,
                state.balance,
                RowType.GRACE
            );

        } else if (
            pipeline.graceType === GraceType.INTEREST
        ) {

            const principal =
                this.calculateStandardPrincipal(
                    state,
                    interest
                );

            row = this.createPaymentRow(
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
                RowType.GRACE
            );

        } else if (
            pipeline.graceType === GraceType.FULL
        ) {

            row = this.createPaymentRow(
                state,
                paymentDate,
                period,
                0,
                0,
                0,
                state.balance,
                RowType.GRACE
            );

        } else {

            const payment = this.calculatePayment(
                state,
                interest,
                pipeline.effectiveRate
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

            row = this.createPaymentRow(
                state,
                paymentDate,
                period,
                payment,
                principal,
                interest,
                closingBalance,
                RowType.NORMAL
            );

        }

        row = this.manualAdjustmentProcessor.process(
            state,
            row
        );

        state.addInterest(row.interest);
        state.addRow(row);

    }

    createPaymentRow(
        state,
        paymentDate,
        period,
        payment,
        principal,
        interest,
        closingBalance,
        rowType = RowType.NORMAL
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
                effectiveRate: state.effectiveRate
            }

        });

    }

    calculatePayment(
        state,
        interest,
        effectiveRate
    ) {

        const loan = state.loan;

        if (this.isLastPayment(state)) {

            return Money.add(
                state.balance,
                interest
            );

        }

        switch (loan.paymentMethod) {

            case PaymentMethod.ANNUITY:

                return PaymentCalculator.calculateAnnuity(
                    loan.principal,
                    effectiveRate,
                    loan.term
                );

            case PaymentMethod.EQUAL_PRINCIPAL: {

                const remainingPeriods =
                    loan.term - state.period;

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
        interest
    ) {

        if (this.isLastPayment(state)) {

            return Money.round(state.balance);

        }

        const payment = this.calculatePayment(
            state,
            interest,
            state.effectiveRate
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

        if (this.isLastPayment(state)) {

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

        if (this.isLastPayment(state)) {
            return 0;
        }

        return Money.subtract(
            state.balance,
            principal
        );

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

    isFinished(state) {

        if (state.period >= state.loan.term) {
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

    isLastPayment(state) {

        return state.period + 1 >= state.loan.term;

    }

}