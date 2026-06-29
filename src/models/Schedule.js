/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * Schedule.js
 *
 * График платежей.
 * ==========================================================
 */

import PaymentRow from "./PaymentRow.js";
import Money from "../core/Money.js";

export default class Schedule {

    constructor(rows = []) {

        if (!Array.isArray(rows)) {
            throw new TypeError("rows must be an array.");
        }

        for (const row of rows) {

            if (!(row instanceof PaymentRow)) {
                throw new TypeError(
                    "Schedule accepts only PaymentRow objects."
                );
            }

        }

        this.rows = Object.freeze([...rows]);

        Object.freeze(this);

    }

    /**
     * Количество строк графика.
     */
    get length() {

        return this.rows.length;

    }

    /**
     * Получить строку.
     */
    get(index) {

        return this.rows[index];

    }

    /**
     * Общая сумма платежей.
     */
    totalPayment() {

        return Money.round(

            this.rows.reduce(

                (sum, row) => sum + row.payment,

                0

            )

        );

    }

    /**
     * Общая сумма процентов.
     */
    totalInterest() {

        return Money.round(

            this.rows.reduce(

                (sum, row) => sum + row.interest,

                0

            )

        );

    }

    /**
     * Общая сумма основного долга.
     */
    totalPrincipal() {

        return Money.round(

            this.rows.reduce(

                (sum, row) => sum + row.principal,

                0

            )

        );

    }

    /**
     * Последний остаток.
     */
    finalBalance() {

        if (this.rows.length === 0) {
            return 0;
        }

        return this.rows[this.rows.length - 1].closingBalance;

    }

    /**
     * JSON.
     */
    toJSON() {

        return {

            rows: this.rows.map(

                row => row.toJSON()

            )

        };

    }

}