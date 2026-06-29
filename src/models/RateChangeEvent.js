/**
 * ==========================================================
 * RateChangeEvent
 * ==========================================================
 */

import Event from "./Event.js";
import Validation from "../core/Validation.js";
import { EventType } from "../core/Enums.js";

export default class RateChangeEvent extends Event {

    constructor({

        id,

        date,

        annualRate,

        enabled = true

    }) {

        super({

            id,

            date,

            type: EventType.RATE_CHANGE,

            enabled

        });

        Validation.requirePositiveOrZero(
            "annualRate",
            annualRate
        );

        this.annualRate = annualRate;

        Object.freeze(this);

    }

}