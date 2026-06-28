/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0
 *
 * Constants.js
 *
 * Глобальные константы проекта.
 * Не содержит бизнес-логики.
 * ==========================================================
 */

export const PROJECT = Object.freeze({

    NAME: "Colvir Schedule & APR Calculator (KZ)",

    VERSION: "4.0-dev1"

});

export const CURRENCY = Object.freeze({

    CODE: "KZT",

    FRACTION_DIGITS: 2

});

export const ROUNDING = Object.freeze({

    MONEY: 2,

    RATE: 8,

    APR: 8,

    DAYS: 0

});

export const DAY_COUNT = Object.freeze({

    ACTUAL_360: 360

});


export const APR = Object.freeze({

    MAX_ITERATIONS: 1000,

    EPSILON: 0.00000001

});