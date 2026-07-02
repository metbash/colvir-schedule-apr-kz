/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev2
 *
 * ScheduleEngine.js
 *
 * Этап 1:
 * Завершение базового движка построения графика.
 *
 * Важные ограничения текущего этапа:
 * - Движок не реализует Grace Period, досрочное погашение,
 *   изменение ставки и ручные корректировки.
 * - Архитектура сохраняется без переписывания.
 * - Используются только существующие классы проекта.
 * - Перенос рабочих дней выполняется только через Calendar.
 * - Первый платеж определяется как issueDate -> firstPaymentDate.
 * - Последний платеж полностью закрывает остаток.
 *
 * Поведение Colvir, требующее следующих этапов,
 * не подменяется предположениями в этом файле.
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
import {
    RowType,
    PaymentMethod,
    BusinessDayConvention
} from "../core/Enums.js";

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
     * Добавить техническую строку выдачи кредита.
     *
     * @param {LoanState} state
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

            rowType: RowType.NORMAL

        });

        state.addRow(row);

    }

    /**
     * Выполнить расчет одного периода.
     *
     * @param {LoanState} state
     */
    processNextPeriod(state) {

        const paymentDate = this.calculateNextPaymentDate(state);

        const period = PeriodCalculator.calculate(
            state.currentDate,
            paymentDate
        );

        const interest = InterestCalculator.calculate(
            state.balance,
            state.loan.annualRate,
            period.days
        );

        const payment = this.calculatePayment(
            state,
            interest
        );

        const principal = this.calculatePrincipal(
            state,
            payment,
            interest
        );

        const closingBalance = this.calculateClosingBalance(
            state,
            principal
        );

        const row = this.createPaymentRow(
            state,
            paymentDate,
            period,
            payment,
            principal,
            interest,
            closingBalance
        );

        state.addInterest(interest);
        state.addRow(row);

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

            paymentDate: DateUtils.clone(paymentDate),

            days: period.days,

            openingBalance: state.balance,

            principal,

            interest,

            payment,

            closingBalance,

            rowType: RowType.NORMAL

        });

    }

    /**
     * Рассчитать сумму платежа.
     *
     * Текущий этап поддерживает только базовые методы:
     * - аннуитет;
     * - равные доли основного долга.
     *
     * Grace Period и другие специальные сценарии
     * должны добавляться на следующих этапах через
     * существующую архитектуру processors/events.
     *
     * @param {LoanState} state
     * @param {number} interest
     * @returns {number}
     */
    calculatePayment(state, interest) {

        const loan = state.loan;

        if (this.isLastPayment(state)) {

            return Money.add(
                state.balance,
                interest
            );

        }

        switch (loan.paymentMethod) {

            case PaymentMethod.ANNUITY:

                return PaymentCalculator.calculateAnnuity(
                    loan.principal,
                    loan.annualRate,
                    loan.term
                );

            case PaymentMethod.EQUAL_PRINCIPAL: {

                const remainingPeriods =
                    loan.term - state.period;

                const principalPart =
                    PaymentCalculator.calculateEqualPrincipal(
                        state.balance,
                        remainingPeriods
                    );

                return Money.add(
                    principalPart,
                    interest
                );

            }

            default:

                throw new Error(
                    "Unknown payment method."
                );

        }

    }

    /**
     * Рассчитать погашение основного долга.
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

        if (this.isLastPayment(state)) {

            return Money.round(
                state.balance
            );

        }

        let principal = Money.subtract(
            payment,
            interest
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
     * Рассчитать остаток после платежа.
     *
     * @param {LoanState} state
     * @param {number} principal
     * @returns {number}
     */
    calculateClosingBalance(state, principal) {

        if (this.isLastPayment(state)) {

            return 0;

        }

        return Money.subtract(
            state.balance,
            principal
        );

    }

    /**
     * Следующая дата платежа.
     *
     * Правило проекта:
     * issueDate -> firstPaymentDate -> далее от firstPaymentDate.
     *
     * Нельзя считать первый платеж как issueDate + 1 месяц.
     *
     * Для предотвращения накопления ошибок переносов
     * каждая следующая дата рассчитывается относительно
     * firstPaymentDate, а не относительно предыдущей даты платежа.
     *
     * @param {LoanState} state
     * @returns {Date}
     */
    calculateNextPaymentDate(state) {

        let paymentDate;

        if (state.period === 0) {

            paymentDate = DateUtils.clone(
                state.loan.firstPaymentDate
            );

        } else {

            paymentDate = DateUtils.addMonths(
                state.loan.firstPaymentDate,
                state.period
            );

        }

        return this.adjustPaymentDate(
            paymentDate
        );

    }

    /**
     * Перенести дату через существующий Calendar.
     *
     * Внутри ScheduleEngine переносы не реализуются.
     *
     * @param {Date} paymentDate
     * @returns {Date}
     */
    adjustPaymentDate(paymentDate) {

        if (
            this.calendar &&
            typeof this.calendar.adjustDate === "function"
        ) {

            return this.calendar.adjustDate(
                paymentDate,
                BusinessDayConvention.FOLLOWING
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
            state.period >= state.loan.term
        ) {

            return true;

        }

        if (
            state.period > 0 &&
            Money.isZero(state.balance)
        ) {

            return true;

        }

        return false;

    }

    /**
     * Проверка последнего платежа.
     *
     * Последний период должен полностью закрыть остаток,
     * чтобы устранить накопленные ошибки округления.
     *
     * @param {LoanState} state
     * @returns {boolean}
     */
    isLastPayment(state) {

        return state.period + 1 >= state.loan.term;

    }

}