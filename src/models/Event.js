/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * Event.js
 *
 * Базовый класс событий.
 * ==========================================================
 */

import Validation from "../core/Validation.js";

export default class Event {

    constructor({

        id,

        date,

        type,

        enabled = true

    }) {

        Validation.requireInteger("id", id);

        Validation.requireDate("date", date);

        this.id = id;

        this.date = new Date(date);

        this.type = type;

        this.enabled = enabled;

    }

}