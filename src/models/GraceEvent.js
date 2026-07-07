/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev10
 *
 * GraceEvent.js
 *
 * Событие льготного периода.
 * Поддерживает типы: PRINCIPAL, INTEREST, FULL.
 * ==========================================================
 */

import Event from "./Event.js";
import Validation from "../core/Validation.js";
import { GraceType, EventType } from "../core/Enums.js";

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

            type: EventType.GRACE,

            enabled

        });

        if (!Object.values(GraceType).includes(graceType)) {

            throw new Error(
                "Unknown grace type. " +
                "Allowed values: NONE, PRINCIPAL, INTEREST, FULL."
            );

        }

        Validation.requireInteger(
            "startPeriod",
            startPeriod
        );

        Validation.requireInteger(
            "endPeriod",
            endPeriod
        );

        if (startPeriod < 1) {

            throw new RangeError(
                "startPeriod must be >= 1."
            );

        }

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

    getGraceType() {

        return this.graceType;

    }

    getStartPeriod() {

        return this.startPeriod;

    }

    getEndPeriod() {

        return this.endPeriod;

    }

    isApplicableToPeriod(periodNumber) {

        return (
            periodNumber >= this.startPeriod &&
            periodNumber <= this.endPeriod
        );

    }

    toJSON() {

        return {
            id: this.id,
            date: this.date,
            type: this.type,
            graceType: this.graceType,
            startPeriod: this.startPeriod,
            endPeriod: this.endPeriod,
            enabled: this.enabled
        };

    }

}