/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev6
 *
 * EventPipelineProcessor.js
 * ==========================================================
 */

import BaseProcessor from "./BaseProcessor.js";
import GraceProcessor from "./GraceProcessor.js";
import RateChangeProcessor from "./RateChangeProcessor.js";

export default class EventPipelineProcessor extends BaseProcessor {

    constructor() {

        super();

        this.graceProcessor = new GraceProcessor();

        this.rateChangeProcessor =
            new RateChangeProcessor();

    }

    process(state) {

        return {

            graceType: this.graceProcessor.process(
                state
            ),

            effectiveRate: this.rateChangeProcessor.process(
                state
            )

        };

    }

}