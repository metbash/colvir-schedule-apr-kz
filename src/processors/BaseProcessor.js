/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * BaseProcessor.js
 *
 * Базовый процессор расчета.
 * ==========================================================
 */

export default class BaseProcessor {

    /**
     * Выполнить обработку.
     *
     * @param {LoanState} state
     */
    process(state) {

        throw new Error(
            "process() must be implemented."
        );

    }

}