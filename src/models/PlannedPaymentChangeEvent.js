/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * PlannedPaymentChangeEvent.js
 *
 * Событие изменения планового платежа.
 * ==========================================================
 */

import Event from "./Event.js";
import Validation from "../core/Validation.js";
import { EventType } from "../core/Enums.js";

export default class PlannedPaymentChangeEvent extends Event {

    constructor({

        id,

        date,

        payment,

        enabled = true

    }) {

        super({

            id,

            date,

            type: EventType.PLANNED_PAYMENT_CHANGE,

            enabled

        });

        Validation.requirePositive(
            "payment",
            payment
        );

        this.payment = payment;

        Object.freeze(this);

    }

}