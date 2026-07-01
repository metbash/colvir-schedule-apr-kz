/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * ScheduleEngine.js
 * ==========================================================
 */

import LoanState from "../models/LoanState.js";
import PaymentRow from "../models/PaymentRow.js";
import Schedule from "../models/Schedule.js";

import InterestCalculator from "../math/InterestCalculator.js";
import PaymentCalculator from "../math/PaymentCalculator.js";
import PeriodCalculator from "../math/PeriodCalculator.js";

import DateUtils from "../core/DateUtils.js";
import Money from "../core/Money.js";
import { RowType } from "../core/Enums.js";

export default class ScheduleEngine {

    constructor(calendar) {

        this.calendar = calendar;

    }

    /**
     * Построить график.
     *
     * @param {Loan} loan
     * @returns {Schedule}
     */
    generate(loan) {

        const state = new LoanState(loan);

        this.addIssueRow(state);

        while (!this.isFinished(state)) {

            this.processNextPeriod(state);

        }

        return new Schedule(state.rows);

    }

    /**
     * Добавить строку выдачи.
     */
    addIssueRow(state) {

        const row = new PaymentRow({

            period: 0,

            paymentDate: DateUtils.clone(
                state.loan.issueDate
            ),

            days: 0,

            openingBalance: state.loan.principal,

            principal: 0,

            interest: 0,

            payment: 0,

            closingBalance: state.loan.principal,

            rowType: RowType.ISSUE

        });

        state.addRow(row);

    }

    /**
     * Выполнить расчет одного периода.
     */
    processNextPeriod(state) {

        const paymentDate =
            this.calculateNextPaymentDate(state);

        const period =
            PeriodCalculator.calculate(

                state.currentDate,

                paymentDate

            );

        const interest =
            InterestCalculator.calculate(

                state.balance,

                state.loan.annualRate,

                period.days

            );

        const payment =
            this.calculatePayment(

                state,

                interest

            );

        const principal =
            this.calculatePrincipal(

                state,

                payment,

                interest

            );

        const closingBalance =
            Money.round(

                state.balance -

                principal

            );

        const row =
            this.createPaymentRow(

                state,

                paymentDate,

                period,

                payment,

                principal,

                interest,

                closingBalance

            );

        state.addInterest(

            interest

        );

        state.addRow(

            row

        );

    }
        /**
     * Создать строку графика.
     *
     * @param {LoanState} state
     * @param {Date} paymentDate
     * @param {Object} period
     * @param {number} payment
     * @param {number} principal
     * @param {number} interest
     * @param {number} closingBalance
     * @returns {PaymentRow}
     */
    createPaymentRow(
        state,
        paymentDate,
        period,
        payment,
        principal,
        interest,
        closingBalance
    ) {

        return new PaymentRow({

            period: state.period + 1,

            paymentDate,

            days: period.days,

            openingBalance: state.balance,

            principal,

            interest,

            payment,

            closingBalance,

            // ISSUE и CLOSING добавим позже
            rowType: RowType.NORMAL

        });

    }

    /**
     * Рассчитать сумму платежа.
     *
     * @param {LoanState} state
     * @param {number} interest
     * @returns {number}
     */
    calculatePayment(
        state,
        interest
    ) {

        const loan = state.loan;

        let payment;

        switch (loan.paymentMethod) {

            case "ANNUITY":

                payment =
                    PaymentCalculator.calculateAnnuity(

                        loan.principal,

                        loan.annualRate,

                        loan.term

                    );

                break;

            case "EQUAL_PRINCIPAL":

                payment =

                    PaymentCalculator.calculateEqualPrincipal(

                        loan.principal,

                        loan.term

                    ) +

                    interest;

                break;

            default:

                throw new Error(

                    "Unknown payment method."

                );

        }

        return Money.round(payment);

    }

    /**
     * Рассчитать погашение тела.
     *
     * @param {LoanState} state
     * @param {number} payment
     * @param {number} interest
     * @returns {number}
     */
    calculatePrincipal(
        state,
        payment,
        interest
    ) {

        let principal = Money.round(

            payment - interest

        );

        if (principal < 0) {

            principal = 0;

        }

        if (principal > state.balance) {

            principal = state.balance;

        }

        return Money.round(principal);

    }

    /**
     * Следующая дата платежа.
     *
     * Пока используется простой
     * переход на месяц вперед.
     * Позже здесь будет Calendar.
     *
     * @param {LoanState} state
     * @returns {Date}
     */
    calculateNextPaymentDate(state) {

        let paymentDate =

            DateUtils.addMonths(

                state.currentDate,

                1

            );

        if (

            this.calendar &&

            typeof this.calendar.adjust === "function"

        ) {

            paymentDate =

                this.calendar.adjust(

                    paymentDate,

                    state.loan.businessDayConvention

                );

        }

        return paymentDate;

    }

    /**
     * Проверка окончания построения графика.
     *
     * @param {LoanState} state
     * @returns {boolean}
     */
    isFinished(state) {

        if (

            Money.round(state.balance) <= 0

        ) {

            return true;

        }

        if (

            state.period >= state.loan.term

        ) {

            return true;

        }

        return false;

    }
        
    /**
     * Выполнить весь расчет.
     *
     * Используется generate().
     *
     * @param {LoanState} state
     */
    calculate(state) {

        while (!this.isFinished(state)) {

            this.calculateRow(state);

        }

    }

    /**
     * Получить последнюю строку.
     *
     * @param {LoanState} state
     * @returns {PaymentRow|null}
     */
    getLastRow(state) {

        if (state.rows.length === 0) {
            return null;
        }

        return state.rows[state.rows.length - 1];

    }

    /**
     * Проверка последнего платежа.
     *
     * @param {LoanState} state
     * @returns {boolean}
     */
    isLastPayment(state) {

        return Money.round(state.balance) <= 0;

    }

    /**
     * Исправить ошибки округления.
     *
     * @param {LoanState} state
     */
    normalizeSchedule(state) {

        const lastRow = this.getLastRow(state);

        if (!lastRow) {
            return;
        }

        if (Money.round(lastRow.closingBalance) !== 0) {
            return;
        }

        lastRow.closingBalance = 0;

    }

    /**
     * Проверка результата.
     *
     * @param {Schedule} schedule
     */
    validate(schedule) {

        if (!schedule) {
            throw new Error("Schedule is null.");
        }

        if (!schedule.rows) {
            throw new Error("Schedule rows are missing.");
        }

        if (schedule.rows.length === 0) {
            throw new Error("Schedule is empty.");
        }

    }

  

}