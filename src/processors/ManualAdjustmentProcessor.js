/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * ManualAdjustmentProcessor.js
 *
 * Процессор ручных корректировок.
 *
 * Поддерживает:
 * - PAYMENT
 * - PRINCIPAL
 * - INTEREST
 * - PAYMENT_DATE
 * ==========================================================
 */

import BaseProcessor from "./BaseProcessor.js";
import PaymentRow from "../models/PaymentRow.js";
import Money from "../core/Money.js";
import {
    ManualAdjustmentType,
    RowType
} from "../core/Enums.js";

export default class ManualAdjustmentProcessor extends BaseProcessor {

    /**
     * Применить все ручные корректировки
     * к уже рассчитанной строке.
     *
     * @param {LoanState} state
     * @param {PaymentRow} row
     * @returns {PaymentRow}
     */
    process(state, row) {

        const events =
            state.getManualAdjustmentEventsForDate(
                row.paymentDate
            );

        if (events.length === 0) {

            return row;

        }

        let adjustedRow = row;

        for (const event of events) {

            adjustedRow = this.applyEvent(
                adjustedRow,
                event
            );

        }

        return adjustedRow;

    }

    applyEvent(row, event) {

        switch (event.adjustmentType) {

            case ManualAdjustmentType.PAYMENT:
                return this.applyPaymentAdjustment(
                    row,
                    event.value
                );

            case ManualAdjustmentType.PRINCIPAL:
                return this.applyPrincipalAdjustment(
                    row,
                    event.value
                );

            case ManualAdjustmentType.INTEREST:
                return this.applyInterestAdjustment(
                    row,
                    event.value
                );

            case ManualAdjustmentType.PAYMENT_DATE:
                return this.applyPaymentDateAdjustment(
                    row,
                    event.value
                );

            default:
                throw new Error(
                    "Unknown manual adjustment type."
                );

        }

    }

    applyPaymentAdjustment(row, payment) {

        const principal = Money.max(
            0,
            Money.subtract(payment, row.interest)
        );

        const closingBalance = Money.max(
            0,
            Money.subtract(
                row.openingBalance,
                principal
            )
        );

        return this.cloneRow(row, {
            payment,
            principal,
            closingBalance
        });

    }

    applyPrincipalAdjustment(row, principal) {

        const payment = Money.add(
            principal,
            row.interest
        );

        const closingBalance = Money.max(
            0,
            Money.subtract(
                row.openingBalance,
                principal
            )
        );

        return this.cloneRow(row, {
            principal,
            payment,
            closingBalance
        });

    }

    applyInterestAdjustment(row, interest) {

        const payment = Money.add(
            row.principal,
            interest
        );

        return this.cloneRow(row, {
            interest,
            payment
        });

    }

    applyPaymentDateAdjustment(row, value) {

        const paymentDate = value instanceof Date
            ? value
            : new Date(value);

        return this.cloneRow(row, {
            paymentDate
        });

    }

    cloneRow(row, patch) {

        return new PaymentRow({

            period: row.period,

            paymentDate: patch.paymentDate || row.paymentDate,

            days: row.days,

            openingBalance: row.openingBalance,

            principal:
                patch.principal ?? row.principal,

            interest:
                patch.interest ?? row.interest,

            payment:
                patch.payment ?? row.payment,

            closingBalance:
                patch.closingBalance ?? row.closingBalance,

            rowType: RowType.MANUAL,

            metadata: {
                ...row.metadata,
                manualAdjustment: true
            }

        });

    }

}