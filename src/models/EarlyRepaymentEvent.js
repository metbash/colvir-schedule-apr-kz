/**
 * ==========================================================
 * EarlyRepaymentEvent
 * ==========================================================
 */

import Event from "./Event.js";
import Validation from "../core/Validation.js";
import { EventType } from "../core/Enums.js";

export default class EarlyRepaymentEvent extends Event {

    constructor({

        id,

        date,

        amount,

        enabled = true

    }) {

        super({

            id,

            date,

            type: EventType.EARLY_REPAYMENT,

            enabled

        });

        Validation.requirePositive(
            "amount",
            amount
        );

        this.amount = amount;

        Object.freeze(this);

    }

}