/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev2
 *
 * NormalScheduleProcessor.js
 *
 * Процессор стандартного периода.
 *
 * На Этапе 1 банковская логика расчета еще остается
 * внутри ScheduleEngine, чтобы не дублировать код
 * и не разрывать уже рабочий поток построения графика.
 *
 * Этот класс сохраняется как часть утвержденной
 * архитектуры processors и доводится до честного
 * промежуточного состояния без заглушечной имитации.
 * ==========================================================
 */

import BaseProcessor from "./BaseProcessor.js";

export default class NormalScheduleProcessor extends BaseProcessor {

    constructor(scheduleEngine) {

        super();

        this.scheduleEngine = scheduleEngine;

    }

    /**
     * Выполнить обработку стандартного периода.
     *
     * На текущем этапе процессор делегирует расчет
     * в существующий ScheduleEngine, который уже
     * содержит рабочую базовую реализацию периода.
     *
     * @param {LoanState} state
     * @returns {LoanState}
     */
    process(state) {

        if (!this.scheduleEngine) {

            throw new Error(
                "NormalScheduleProcessor requires scheduleEngine."
            );

        }

        this.scheduleEngine.processNextPeriod(state);

        return state;

    }

}