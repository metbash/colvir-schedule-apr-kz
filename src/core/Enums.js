/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * Enums.js
 *
 * Все перечисления проекта.
 * ==========================================================
 */

/**
 * Метод погашения кредита.
 */
export const PaymentMethod = Object.freeze({

    ANNUITY: "ANNUITY",

    EQUAL_PRINCIPAL: "EQUAL_PRINCIPAL"

});

/**
 * Тип льготного периода.
 */
export const GraceType = Object.freeze({

    NONE: "NONE",

    PRINCIPAL: "PRINCIPAL",

    INTEREST: "INTEREST",

    FULL: "FULL"

});

/**
 * Способ распределения после льготы.
 */
export const DistributionMode = Object.freeze({

    FIRST_PAYMENT: "FIRST_PAYMENT",

    ALL_NEXT_PAYMENTS: "ALL_NEXT_PAYMENTS"

});

/**
 * Тип события.
 */
export const EventType = Object.freeze({

    GRACE: "GRACE",

    RATE_CHANGE: "RATE_CHANGE",

    EARLY_REPAYMENT: "EARLY_REPAYMENT",

    MANUAL_ADJUSTMENT: "MANUAL_ADJUSTMENT",

    RESTRUCTURE: "RESTRUCTURE"

});

/**
 * Политика переноса даты.
 */
export const HolidayPolicy = Object.freeze({

    NEXT_WORKING_DAY: "NEXT_WORKING_DAY"

});

/**
 * Статус строки графика.
 */
export const RowStatus = Object.freeze({

    NORMAL: "NORMAL",

    GRACE: "GRACE",

    MANUAL: "MANUAL",

    EARLY_REPAYMENT: "EARLY_REPAYMENT",

    RESTRUCTURED: "RESTRUCTURED"

});

/**
 * Тип изменения ставки.
 */
export const RateChangeType = Object.freeze({

    FIXED: "FIXED",

    VARIABLE: "VARIABLE"

});

/**
 * Тип досрочного погашения.
 */
export const EarlyRepaymentType = Object.freeze({

    PARTIAL: "PARTIAL",

    FULL: "FULL"

});

/**
 * Режим перерасчета.
 */
export const RecalculationMode = Object.freeze({

    KEEP_PAYMENT: "KEEP_PAYMENT",

    KEEP_TERM: "KEEP_TERM"

});

/**
 * Тип ручной корректировки.
 */
export const ManualAdjustmentType = Object.freeze({

    PAYMENT: "PAYMENT",

    PRINCIPAL: "PRINCIPAL",

    INTEREST: "INTEREST",

    PAYMENT_DATE: "PAYMENT_DATE"

});