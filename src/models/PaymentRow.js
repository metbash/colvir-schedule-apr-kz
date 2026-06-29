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
import { RowType } from "../core/Enums.js";

export default class PaymentRow {

    constructor({

        period,

        paymentDate,

        days,

        openingBalance,

        principal,

        interest,

        payment,

        closingBalance,

        rowType = RowType.NORMAL,

        metadata = {}

    }) {

        Validation.requireInteger("period", period);

        Validation.requireDate("paymentDate", paymentDate);

        Validation.requirePositiveOrZero("days", days);

        Validation.requirePositiveOrZero("openingBalance", openingBalance);

        Validation.requirePositiveOrZero("principal", principal);

        Validation.requirePositiveOrZero("interest", interest);

        Validation.requirePositiveOrZero("payment", payment);

        Validation.requirePositiveOrZero("closingBalance", closingBalance);

        if (!Object.values(RowType).includes(rowType)) {

            throw new Error("Unknown row type.");

        }

        this.period = period;

        this.paymentDate = new Date(paymentDate);

        this.days = days;

        this.openingBalance = Money.round(openingBalance);

        this.principal = Money.round(principal);

        this.interest = Money.round(interest);

        this.payment = Money.round(payment);

        this.closingBalance = Money.round(closingBalance);

        this.rowType = rowType;

        this.metadata = Object.freeze({

            ...metadata

        });

        Object.freeze(this);

    }

    toJSON() {

        return {

            period: this.period,

            paymentDate: this.paymentDate,

            days: this.days,

            openingBalance: this.openingBalance,

            principal: this.principal,

            interest: this.interest,

            payment: this.payment,

            closingBalance: this.closingBalance,

            rowType: this.rowType,

            metadata: this.metadata

        };

    }

}