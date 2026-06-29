/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * GraceEvent.js
 *
 * Событие льготного периода.
 * ==========================================================
 */

import Event from "./Event.js";
import Validation from "../core/Validation.js";
import { GraceType } from "../core/Enums.js";

export default class GraceEvent extends Event {

    constructor({

        id,

        date,

        graceType,

        startPeriod,

        endPeriod,

        enabled = true

    }) {

        super({

            id,

            date,

            type: "GRACE",

            enabled

        });

        if (!Object.values(GraceType).includes(graceType)) {

            throw new Error("Unknown grace type.");

        }

        Validation.requireInteger("startPeriod", startPeriod);
        Validation.requireInteger("endPeriod", endPeriod);

        if (endPeriod < startPeriod) {

            throw new RangeError(
                "endPeriod must be greater than or equal to startPeriod."
            );

        }

        this.graceType = graceType;

        this.startPeriod = startPeriod;

        this.endPeriod = endPeriod;

        Object.freeze(this);

    }

}