import Validation from "../core/Validation.js";
import { PaymentMethod } from "../core/Enums.js";

export default class Loan {
    constructor({
        principal,
        annualRate,
        term,
        issueDate,
        firstPaymentDate,
        lastPaymentDate = null,
        paymentMethod,
        gracePeriods = []
    }) {
        Validation.requirePositive("principal", principal);
        Validation.requirePositiveOrZero("annualRate", annualRate);
        Validation.requireInteger("term", term);
        Validation.requireDate("issueDate", issueDate);
        Validation.requireDate("firstPaymentDate", firstPaymentDate);

        if (lastPaymentDate !== null) {
            Validation.requireDate("lastPaymentDate", lastPaymentDate);
        }

        if (!Object.values(PaymentMethod).includes(paymentMethod)) {
            throw new Error("Unknown payment method.");
        }

        if (!Array.isArray(gracePeriods)) {
            throw new TypeError("gracePeriods must be an array.");
        }

        this.principal = Number(principal);
        this.annualRate = Number(annualRate);
        this.term = Number(term);
        this.issueDate = new Date(issueDate);
        this.firstPaymentDate = new Date(firstPaymentDate);
        this.lastPaymentDate = lastPaymentDate ? new Date(lastPaymentDate) : null;
        this.paymentMethod = paymentMethod;
        this.gracePeriods = gracePeriods.map(g => ({
            startPeriod: Number(g.startPeriod),
            endPeriod: Number(g.endPeriod),
            odGrace: Boolean(g.odGrace),
            percentGrace: Boolean(g.percentGrace),
            distributionMode: g.distributionMode
        }));

        Object.freeze(this);
    }
}