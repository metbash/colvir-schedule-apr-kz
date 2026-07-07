/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev2
 *
 * Enums.js
 * ==========================================================
 */

export const PaymentMethod = Object.freeze({
    ANNUITY: "ANNUITY",
    EQUAL_PRINCIPAL: "EQUAL_PRINCIPAL"
});

export const GraceType = Object.freeze({
    NONE: "NONE",
    PRINCIPAL: "PRINCIPAL",
    INTEREST: "INTEREST",
    FULL: "FULL"
});

export const DistributionMode = Object.freeze({
    FIRST_PAYMENT: "FIRST_PAYMENT",
    ALL_NEXT_PAYMENTS: "ALL_NEXT_PAYMENTS"
});

export const EventType = Object.freeze({
    GRACE: "GRACE",
    RATE_CHANGE: "RATE_CHANGE",
    EARLY_REPAYMENT: "EARLY_REPAYMENT",
    MANUAL_ADJUSTMENT: "MANUAL_ADJUSTMENT",
    PLANNED_PAYMENT_CHANGE: "PLANNED_PAYMENT_CHANGE",
    RESTRUCTURE: "RESTRUCTURE"
});

export const HolidayPolicy = Object.freeze({
    NEXT_WORKING_DAY: "NEXT_WORKING_DAY"
});

export const RowType = Object.freeze({
    NORMAL: "NORMAL",
    GRACE: "GRACE",
    MANUAL: "MANUAL",
    EARLY_REPAYMENT: "EARLY_REPAYMENT",
    RESTRUCTURED: "RESTRUCTURED"
});

export const RowStatus = Object.freeze({
    NORMAL: "NORMAL",
    GRACE: "GRACE",
    MANUAL: "MANUAL",
    EARLY_REPAYMENT: "EARLY_REPAYMENT",
    RESTRUCTURED: "RESTRUCTURED"
});

export const RateChangeType = Object.freeze({
    FIXED: "FIXED",
    VARIABLE: "VARIABLE"
});

export const EarlyRepaymentType = Object.freeze({
    PARTIAL: "PARTIAL",
    FULL: "FULL"
});

export const RecalculationMode = Object.freeze({
    KEEP_PAYMENT: "KEEP_PAYMENT",
    KEEP_TERM: "KEEP_TERM"
});

export const ManualAdjustmentType = Object.freeze({
    PAYMENT: "PAYMENT",
    PRINCIPAL: "PRINCIPAL",
    INTEREST: "INTEREST",
    PAYMENT_DATE: "PAYMENT_DATE"
});

export const BusinessDayConvention = Object.freeze({
    NONE: "NONE",
    FOLLOWING: "FOLLOWING",
    MODIFIED_FOLLOWING: "MODIFIED_FOLLOWING",
    PRECEDING: "PRECEDING",
    MODIFIED_PRECEDING: "MODIFIED_PRECEDING"
});