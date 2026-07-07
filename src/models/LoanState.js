/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev6
 *
 * LoanState.js
 *
 * Рабочее состояние кредита во время расчета.
 * ==========================================================
 */

import Validation from "../core/Validation.js";
import Money from "../core/Money.js";
import DateUtils from "../core/DateUtils.js";
import {
    EventType,
    GraceType
} from "../core/Enums.js";

export default class LoanState {

    constructor(loan) {

        if (!loan) {
            throw new Error("Loan is required.");
        }

        this.loan = loan;

        this.balance = Money.round(
            loan.principal
        );

        this.accruedInterest = 0;

        this.period = 0;

        this.currentDate = DateUtils.clone(
            loan.issueDate
        );

        this.rows = [];

        this.effectiveRate = loan.annualRate;

    }

    addRow(row) {

        this.rows.push(row);

        this.period = row.period;

        this.balance = Money.round(
            row.closingBalance
        );

        this.currentDate = DateUtils.clone(
            row.paymentDate
        );

    }

    addInterest(amount) {

        Validation.requirePositiveOrZero(
            "amount",
            amount
        );

        this.accruedInterest = Money.add(
            this.accruedInterest,
            amount
        );

    }

    reduceBalance(amount) {

        Validation.requirePositiveOrZero(
            "amount",
            amount
        );

        this.balance = Money.subtract(
            this.balance,
            amount
        );

    }

    nextPeriod() {

        this.period++;

    }

    getNextPeriodNumber() {

        return this.period + 1;

    }

    getEnabledEvents() {

        if (
            !this.loan.events ||
            !Array.isArray(this.loan.events)
        ) {

            return [];

        }

        return this.loan.events.filter(
            (event) => event.enabled
        );

    }

    getEventsByType(eventType) {

        return this.getEnabledEvents().filter(
            (event) => event.type === eventType
        );

    }

    getActiveGraceEvents() {

        const nextPeriod = this.getNextPeriodNumber();

        return this.getEventsByType(
            EventType.GRACE
        ).filter((event) => {

            return (
                event.startPeriod <= nextPeriod &&
                event.endPeriod >= nextPeriod
            );

        });

    }

    getDateReachedEvents(eventType) {

        return this.getEventsByType(
            eventType
        ).filter((event) => {

            return (
                event.date.getTime() <=
                this.currentDate.getTime()
            );

        });

    }

    /**
     * Получить manual adjustment events,
     * относящиеся к расчетной дате строки.
     *
     * @param {Date} paymentDate
     * @returns {Array}
     */
    getManualAdjustmentEventsForDate(paymentDate) {

        return this.getEventsByType(
            EventType.MANUAL_ADJUSTMENT
        ).filter((event) => {

            return (
                event.date.getFullYear() === paymentDate.getFullYear() &&
                event.date.getMonth() === paymentDate.getMonth() &&
                event.date.getDate() === paymentDate.getDate()
            );

        });

    }

    hasActiveGrace(graceType) {

        return this.getActiveGraceEvents().some(
            (event) => event.graceType === graceType
        );

    }

    hasPrincipalGrace() {

        return this.hasActiveGrace(
            GraceType.PRINCIPAL
        );

    }

    hasInterestGrace() {

        return this.hasActiveGrace(
            GraceType.INTEREST
        );

    }

    hasFullGrace() {

        return this.hasActiveGrace(
            GraceType.FULL
        );

    }

    getActiveRateChangeEvent() {

        const events = this.getDateReachedEvents(
            EventType.RATE_CHANGE
        );

        if (events.length === 0) {

            return null;

        }

        return events[events.length - 1];

    }

    applyRateChange(event) {

        if (!event) {
            return;
        }

        this.effectiveRate = event.annualRate;

    }

}