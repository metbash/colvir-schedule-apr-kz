/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * PaymentRow.js
 *
 * Строка графика платежей.
 * Не содержит расчетов.
 * ==========================================================
 */

import Validation from "../core/Validation.js";
import Money from "../core/Money.js";

export default class PaymentRow {

    constructor({

        period,

        paymentDate,

        days,

        openingBalance,

        principal,

        interest,

        payment,

        closingBalance

    }) {

        Validation.requireInteger("period", period);

        Validation.requireDate("paymentDate", paymentDate);

        Validation.requirePositiveOrZero("days", days);

        Validation.requirePositiveOrZero("openingBalance", openingBalance);

        Validation.requirePositiveOrZero("principal", principal);

        Validation.requirePositiveOrZero("interest", interest);

        Validation.requirePositiveOrZero("payment", payment);

        Validation.requirePositiveOrZero("closingBalance", closingBalance);

        this.period = period;

        this.paymentDate = new Date(paymentDate);

        this.days = days;

        this.openingBalance = Money.round(openingBalance);

        this.principal = Money.round(principal);

        this.interest = Money.round(interest);

        this.payment = Money.round(payment);

        this.closingBalance = Money.round(closingBalance);

        Object.freeze(this);

    }

    /**
     * Представление для JSON.
     */
    toJSON() {

        return {

            period: this.period,

            paymentDate: this.paymentDate,

            days: this.days,

            openingBalance: this.openingBalance,

            principal: this.principal,

            interest: this.interest,

            payment: this.payment,

            closingBalance: this.closingBalance

        };

    }

}