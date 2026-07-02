/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev2
 *
 * CalculationContext.js
 *
 * Контекст расчета для следующих этапов развития движка.
 *
 * На Этапе 1 основной расчет выполняется напрямую
 * через ScheduleEngine и LoanState.
 *
 * Этот класс сохраняется как существующий элемент
 * архитектуры и подготавливается для дальнейшей
 * интеграции processors, Grace Period, изменения ставки,
 * досрочного погашения и APR.
 *
 * На текущем этапе класс не должен содержать
 * самостоятельной банковской логики.
 * ==========================================================
 */

import LoanState from "../models/LoanState.js";
import DateUtils from "../core/DateUtils.js";

export default class CalculationContext {

    constructor(loan, calendar) {

        this.loan = loan;

        this.calendar = calendar;

        this.state = new LoanState(loan);

        /**
         * Индекс расчетного периода.
         * Используется как будущая точка расширения
         * для процессоров и событий.
         */
        this.periodIndex = 0;

        /**
         * Текущая дата расчетного состояния.
         */
        this.currentDate = DateUtils.clone(
            loan.issueDate
        );

        /**
         * Предыдущая дата расчета.
         */
        this.previousDate = DateUtils.clone(
            loan.issueDate
        );

    }

    /**
     * Синхронизировать контекст с актуальным LoanState.
     *
     * Метод не выполняет расчетов.
     * Он только обновляет служебные поля контекста.
     */
    syncFromState() {

        this.periodIndex = this.state.period;

        this.currentDate = DateUtils.clone(
            this.state.currentDate
        );

    }

    /**
     * Зафиксировать предыдущую дату перед переходом
     * к следующему состоянию.
     */
    rememberCurrentDate() {

        this.previousDate = DateUtils.clone(
            this.currentDate
        );

    }

}