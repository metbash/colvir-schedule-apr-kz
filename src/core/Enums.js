/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0
 *
 * Enums.js
 *
 * Перечисления проекта.
 * ==========================================================
 */

import {
    PAYMENT_METHOD,
    GRACE_TYPE,
    DISTRIBUTION_MODE,
    EVENT_TYPE,
    HOLIDAY_POLICY
} from "./Constants.js";

/**
 * Метод погашения
 */
export const PaymentMethod = Object.freeze({
    ...PAYMENT_METHOD
});

/**
 * Тип льготного периода
 */
export const GraceType = Object.freeze({
    ...GRACE_TYPE
});

/**
 * Способ распределения после льготы
 */
export const DistributionMode = Object.freeze({
    ...DISTRIBUTION_MODE
});

/**
 * Тип события графика
 */
export const EventType = Object.freeze({
    ...EVENT_TYPE
});

/**
 * Правило переноса даты платежа
 */
export const HolidayPolicy = Object.freeze({
    ...HOLIDAY_POLICY
});

/**
 * Статус строки графика
 */
export const RowStatus = Object.freeze({

    NORMAL: "NORMAL",

    GRACE: "GRACE",

    MANUAL: "MANUAL",

    EARLY_REPAYMENT: "EARLY_REPAYMENT",

    RESTRUCTURED: "RESTRUCTURED"

});

/**
 * Тип изменения ставки
 */
export const RateChangeType = Object.freeze({

    FIXED: "FIXED",

    VARIABLE: "VARIABLE"

});

/**
 * Тип досрочного погашения
 */
export const EarlyRepaymentType = Object.freeze({

    PARTIAL: "PARTIAL",

    FULL: "FULL"

});

/**
 * Направление перерасчета
 */
export const RecalculationMode = Object.freeze({

    KEEP_PAYMENT: "KEEP_PAYMENT",

    KEEP_TERM: "KEEP_TERM"

});

/**
 * Тип ручной корректировки
 */
export const ManualAdjustmentType = Object.freeze({

    PAYMENT: "PAYMENT",

    PRINCIPAL: "PRINCIPAL",

    INTEREST: "INTEREST",

    PAYMENT_DATE: "PAYMENT_DATE"

});