/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * RestructureEvent.js
 *
 * Событие реструктуризации.
 *
 * На текущем этапе используется как часть
 * завершения event-модели проекта.
 * Бизнес-логика реструктуризации будет
 * реализована на следующем этапе.
 * ==========================================================
 */

import Event from "./Event.js";
import Validation from "../core/Validation.js";
import { EventType } from "../core/Enums.js";

export default class RestructureEvent extends Event {

    constructor({

        id,

        date,

        annualRate = null,

        term = null,

        enabled = true

    }) {

        super({

            id,

            date,

            type: EventType.RESTRUCTURE,

            enabled

        });

        if (annualRate !== null) {

            Validation.requirePositiveOrZero(
                "annualRate",
                annualRate
            );

        }

        if (term !== null) {

            Validation.requireInteger(
                "term",
                term
            );

        }

        this.annualRate = annualRate;

        this.term = term;

        Object.freeze(this);

    }

}