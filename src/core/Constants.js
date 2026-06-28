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

export const PAYMENT_METHOD = Object.freeze({

    ANNUITY: "ANNUITY",

    EQUAL_PRINCIPAL: "EQUAL_PRINCIPAL"

});

export const GRACE_TYPE = Object.freeze({

    NONE: "NONE",

    PRINCIPAL: "PRINCIPAL",

    INTEREST: "INTEREST",

    FULL: "FULL"

});

export const DISTRIBUTION_MODE = Object.freeze({

    FIRST_PAYMENT: "FIRST_PAYMENT",

    ALL_NEXT_PAYMENTS: "ALL_NEXT_PAYMENTS"

});

export const EVENT_TYPE = Object.freeze({

    GRACE: "GRACE",

    RATE_CHANGE: "RATE_CHANGE",

    EARLY_REPAYMENT: "EARLY_REPAYMENT",

    MANUAL_ADJUSTMENT: "MANUAL_ADJUSTMENT"

});

export const HOLIDAY_POLICY = Object.freeze({

    NEXT_WORKING_DAY: "NEXT_WORKING_DAY"

});

export const APR = Object.freeze({

    MAX_ITERATIONS: 1000,

    EPSILON: 0.00000001

});