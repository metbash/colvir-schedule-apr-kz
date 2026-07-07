/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev4
 *
 * Loan.js
 * ==========================================================
 */

import Validation from "../core/Validation.js";

import GraceEvent from "./GraceEvent.js";
import RateChangeEvent from "./RateChangeEvent.js";
import EarlyRepaymentEvent from "./EarlyRepaymentEvent.js";
import ManualAdjustmentEvent from "./ManualAdjustmentEvent.js";
import PlannedPaymentChangeEvent from "./PlannedPaymentChangeEvent.js";
import RestructureEvent from "./RestructureEvent.js";

import {
    PaymentMethod,
    EventType
} from "../core/Enums.js";

export default class Loan {

    constructor({

        principal,

        annualRate,

        term,

        issueDate,

        firstPaymentDate,

        paymentMethod,

        events = []

    }) {

        Validation.requirePositive("principal", principal);
        Validation.requirePositiveOrZero("annualRate", annualRate);
        Validation.requireInteger("term", term);
        Validation.requireDate("issueDate", issueDate);
        Validation.requireDate("firstPaymentDate", firstPaymentDate);

        if (!Object.values(PaymentMethod).includes(paymentMethod)) {
            throw new Error("Unknown payment method.");
        }

        if (!Array.isArray(events)) {
            throw new TypeError("events must be an array.");
        }

        const normalizedEvents = events.map((event) =>
            this.normalizeEvent(event)
        );

        this.principal = principal;
        this.annualRate = annualRate;
        this.term = term;
        this.issueDate = new Date(issueDate);
        this.firstPaymentDate = new Date(firstPaymentDate);
        this.paymentMethod = paymentMethod;
        this.events = Object.freeze(
            normalizedEvents.slice()
        );

        Object.freeze(this);

    }

    normalizeEvent(event) {

        if (
            event instanceof GraceEvent ||
            event instanceof RateChangeEvent ||
            event instanceof EarlyRepaymentEvent ||
            event instanceof ManualAdjustmentEvent ||
            event instanceof PlannedPaymentChangeEvent ||
            event instanceof RestructureEvent
        ) {

            return event;

        }

        if (!event || !event.type) {
            throw new Error("Unknown event type.");
        }

        switch (event.type) {

            case EventType.GRACE:
                return new GraceEvent(event);

            case EventType.RATE_CHANGE:
                return new RateChangeEvent(event);

            case EventType.EARLY_REPAYMENT:
                return new EarlyRepaymentEvent(event);

            case EventType.MANUAL_ADJUSTMENT:
                return new ManualAdjustmentEvent(event);

            case EventType.PLANNED_PAYMENT_CHANGE:
                return new PlannedPaymentChangeEvent(event);

            case EventType.RESTRUCTURE:
                return new RestructureEvent(event);

            default:
                throw new Error("Unknown event type.");

        }

    }

    getEvents() {
        return this.events.slice();
    }

    getEventsByType(eventType) {
        return this.events.filter(
            (event) => event.type === eventType
        );
    }

    getGraceEvents() {
        return this.getEventsByType(
            EventType.GRACE
        );
    }

    getRateChangeEvents() {
        return this.getEventsByType(
            EventType.RATE_CHANGE
        );
    }

    getEarlyRepaymentEvents() {
        return this.getEventsByType(
            EventType.EARLY_REPAYMENT
        );
    }

    getManualAdjustmentEvents() {
        return this.getEventsByType(
            EventType.MANUAL_ADJUSTMENT
        );
    }

    getPlannedPaymentChangeEvents() {
        return this.getEventsByType(
            EventType.PLANNED_PAYMENT_CHANGE
        );
    }

    getRestructureEvents() {
        return this.getEventsByType(
            EventType.RESTRUCTURE
        );
    }

}