/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev2
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
 *
 * Важно:
 * PAYMENT_DATE теперь требует полного пересчета строки,
 * поэтому применяется через ScheduleEngine с передачей
 * расчетного контекста.
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
     * Получить список событий ручной корректировки
     * для конкретной строки.
     *
     * @param {LoanState} state
     * @param {PaymentRow} row
     * @returns {Array}
     */
    getEvents(state, row) {

        return state.getManualAdjustmentEventsForDate(
            row.paymentDate
        );

    }

    /**
     * Применить корректировки, не требующие
     * полного пересчета строки.
     *
     * PAYMENT_DATE здесь не применяется,
     * так как требует пересчета периода и процентов.
     *
     * @param {PaymentRow} row
     * @param {Array} events
     * @returns {PaymentRow}
     */
    applySimpleAdjustments(row, events) {

        let adjustedRow = row;

        for (const event of events) {

            if (
                event.adjustmentType ===
                ManualAdjustmentType.PAYMENT_DATE
            ) {

                continue;

            }

            adjustedRow = this.applyEvent(
                adjustedRow,
                event
            );

        }

        return adjustedRow;

    }

    /**
     * Найти событие изменения даты платежа.
     *
     * @param {Array} events
     * @returns {Object|null}
     */
    getPaymentDateAdjustment(events) {

        const event = events.find((item) => {

            return (
                item.adjustmentType ===
                ManualAdjustmentType.PAYMENT_DATE
            );

        });

        return event || null;

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

            default:
                throw new Error(
                    "Unknown manual adjustment type."
                );

        }

    }

    applyPaymentAdjustment(row, payment) {

        let principal = Money.subtract(
            payment,
            row.interest
        );

        if (principal < 0) {
            principal = 0;
        }

        if (principal > row.openingBalance) {
            principal = row.openingBalance;
        }

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

        if (principal < 0) {
            principal = 0;
        }

        if (principal > row.openingBalance) {
            principal = row.openingBalance;
        }

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

        if (interest < 0) {
            interest = 0;
        }

        const payment = Money.add(
            row.principal,
            interest
        );

        return this.cloneRow(row, {
            interest,
            payment
        });

    }

    markAsManual(row) {

        return this.cloneRow(row, {});

    }

    cloneRow(row, patch) {

        return new PaymentRow({

            period: row.period,

            paymentDate: patch.paymentDate || row.paymentDate,

            days: patch.days ?? row.days,

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