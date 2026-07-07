/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * CashFlow.js
 *
 * Одна денежная операция для расчета ГЭСВ / APR.
 * ==========================================================
 */

import Validation from "../core/Validation.js";
import Money from "../core/Money.js";

export default class CashFlow {

    constructor({

        date,

        amount,

        type = "GENERIC",

        metadata = {}

    }) {

        Validation.requireDate(
            "date",
            date
        );

        Validation.requireNumber(
            "amount",
            amount
        );

        if (typeof type !== "string" || type.length === 0) {
            throw new TypeError(
                "type must be a non-empty string."
            );
        }

        if (
            metadata === null ||
            typeof metadata !== "object" ||
            Array.isArray(metadata)
        ) {
            throw new TypeError(
                "metadata must be an object."
            );
        }

        this.date = new Date(date);

        this.amount = Money.round(amount);

        this.type = type;

        this.metadata = Object.freeze({
            ...metadata
        });

        Object.freeze(this);

    }

    isInflow() {
        return this.amount > 0;
    }

    isOutflow() {
        return this.amount < 0;
    }

    toJSON() {

        return {
            date: this.date,
            amount: this.amount,
            type: this.type,
            metadata: this.metadata
        };

    }

}