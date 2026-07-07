/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * PlannedPaymentChangeProcessor.js
 * ==========================================================
 */

import BaseProcessor from "./BaseProcessor.js";

export default class PlannedPaymentChangeProcessor extends BaseProcessor {

    process(state) {

        const event =
            state.getActivePlannedPaymentChangeEvent();

        if (event) {

            state.applyPlannedPaymentChange(
                event
            );

        }

        return state.plannedPayment;

    }

}