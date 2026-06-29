/**
 * ==========================================================
 * ManualAdjustmentEvent
 * ==========================================================
 */

import Event from "./Event.js";
import Validation from "../core/Validation.js";
import {
    EventType,
    ManualAdjustmentType
} from "../core/Enums.js";

export default class ManualAdjustmentEvent extends Event {

    constructor({

        id,

        date,

        adjustmentType,

        value,

        enabled = true

    }) {

        super({

            id,

            date,

            type: EventType.MANUAL_ADJUSTMENT,

            enabled

        });

        if (!Object.values(
            ManualAdjustmentType
        ).includes(adjustmentType)) {

            throw new Error(
                "Unknown manual adjustment type."
            );

        }

        Validation.requirePositiveOrZero(
            "value",
            value
        );

        this.adjustmentType = adjustmentType;

        this.value = value;

        Object.freeze(this);

    }

}