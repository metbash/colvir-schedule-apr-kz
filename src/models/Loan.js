/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * Loan.js
 *
 * Модель кредита.
 * Не содержит расчетов.
 * ==========================================================
 */

import Validation from "../core/Validation.js";
import { PaymentMethod } from "../core/Enums.js";

export default class Loan {

    constructor({

        principal,

        annualRate,

        term,

        issueDate,

        firstPaymentDate,

        paymentMethod

    }) {

        Validation.requirePositive("principal", principal);
        Validation.requirePositiveOrZero("annualRate", annualRate);
        Validation.requireInteger("term", term);
        Validation.requireDate("issueDate", issueDate);
        Validation.requireDate("firstPaymentDate", firstPaymentDate);

        if (!Object.values(PaymentMethod).includes(paymentMethod)) {

            throw new Error("Unknown payment method.");

        }

        this.principal = principal;

        this.annualRate = annualRate;

        this.term = term;

        this.issueDate = new Date(issueDate);

        this.firstPaymentDate = new Date(firstPaymentDate);

        this.paymentMethod = paymentMethod;

        Object.freeze(this);

    }

}