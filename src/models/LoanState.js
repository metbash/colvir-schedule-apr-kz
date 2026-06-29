/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * LoanState.js
 *
 * Рабочее состояние кредита во время расчета.
 * ==========================================================
 */

import Validation from "../core/Validation.js";
import Money from "../core/Money.js";
import DateUtils from "../core/DateUtils.js";

export default class LoanState {

    constructor(loan) {

        if (!loan) {
            throw new Error("Loan is required.");
        }

        this.loan = loan;

        /**
         * Остаток основного долга
         */
        this.balance = Money.round(
            loan.principal
        );

        /**
         * Начисленные проценты
         */
        this.accruedInterest = 0;

        /**
         * Номер периода
         */
        this.period = 0;

        /**
         * Текущая дата расчета
         */
        this.currentDate = DateUtils.clone(
            loan.issueDate
        );

        /**
         * Построенные строки графика
         */
        this.rows = [];

    }

    /**
     * Добавить строку графика.
     *
     * @param {PaymentRow} row
     */
    addRow(row) {

        this.rows.push(row);

        this.period = row.period;

        this.balance = Money.round(
            row.closingBalance
        );

        this.currentDate = DateUtils.clone(
            row.paymentDate
        );

    }

    /**
     * Общая сумма начисленных процентов.
     *
     * @param {number} amount
     */
    addInterest(amount) {

        Validation.requirePositiveOrZero(
            "amount",
            amount
        );

        this.accruedInterest = Money.add(
            this.accruedInterest,
            amount
        );

    }

    /**
     * Уменьшить остаток долга.
     *
     * @param {number} amount
     */
    reduceBalance(amount) {

        Validation.requirePositiveOrZero(
            "amount",
            amount
        );

        this.balance = Money.subtract(
            this.balance,
            amount
        );

    }

    /**
     * Следующий период.
     */
    nextPeriod() {

        this.period++;

    }

}