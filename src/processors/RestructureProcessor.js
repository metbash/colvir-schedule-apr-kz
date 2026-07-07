/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * RestructureProcessor.js
 * ==========================================================
 */

import BaseProcessor from "./BaseProcessor.js";

export default class RestructureProcessor extends BaseProcessor {

    process(state) {

        const event =
            state.getActiveRestructureEvent();

        if (event) {

            state.applyRestructure(event);

        }

        return event || null;

    }

}