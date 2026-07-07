/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev2
 *
 * RateChangeProcessor.js
 *
 * Применение изменения ставки.
 *
 * На текущем этапе:
 * - применяется последняя достигнутая ставка;
 * - новая ставка влияет на начисление процентов;
 * - полная логика перерасчета планового платежа
 *   может быть расширена на следующем этапе.
 * ==========================================================
 */

import BaseProcessor from "./BaseProcessor.js";

export default class RateChangeProcessor extends BaseProcessor {

    process(state) {

        const rateChangeEvent =
            state.getActiveRateChangeEvent();

        if (rateChangeEvent) {

            state.applyRateChange(
                rateChangeEvent
            );

        }

        return state.effectiveRate;

    }

}