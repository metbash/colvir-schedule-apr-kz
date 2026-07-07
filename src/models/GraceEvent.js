/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * GraceEvent.js
 * ==========================================================
 */

import EventType from "../core/Enums.js";
import Validation from "../core/Validation.js";
import DateUtils from "../core/DateUtils.js";

export default class GraceEvent {

    constructor({

        type = EventType.GRACE,

        startDate,

        gracePrincipalMonths = 0,

        graceInterestMonths = 0,

        metadata = {}

    }) {

        if (type !== EventType.GRACE) {
            throw new Error(
                "GraceEvent must have type EventType.GRACE."
            );
        }

        Validation.requireDate(
            "startDate",
            startDate
        );

        Validation.requirePositiveOrZero(
            "gracePrincipalMonths",
            gracePrincipalMonths
        );

        Validation.requirePositiveOrZero(
            "graceInterestMonths",
            graceInterestMonths
        );

        if (
            metadata === null ||
            typeof metadata !== "object" ||
            Array.isArray(metadata)
        ) {
            throw new TypeError(
                "metadata must be an object."
            );
        }

        this.type = EventType.GRACE;

        this.startDate = new Date(startDate);

        this.gracePrincipalMonths = gracePrincipalMonths;

        this.graceInterestMonths = graceInterestMonths;

        this.metadata = Object.freeze({
            ...metadata
        });

        Object.freeze(this);

    }

    getEffectiveStartDate() {
        return this.startDate;
    }

    getGracePrincipalMonths() {
        return this.gracePrincipalMonths;
    }

    getGraceInterestMonths() {
        return this.graceInterestMonths;
    }

    toJSON() {

        return {
            type: this.type,
            startDate: this.startDate,
            gracePrincipalMonths:
                this.gracePrincipalMonths,
            graceInterestMonths:
                this.graceInterestMonths,
            metadata: this.metadata
        };

    }

}