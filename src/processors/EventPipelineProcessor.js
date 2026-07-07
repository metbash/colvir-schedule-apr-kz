/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev8
 *
 * EventPipelineProcessor.js
 * ==========================================================
 */

import BaseProcessor from "./BaseProcessor.js";
import GraceProcessor from "./GraceProcessor.js";
import RateChangeProcessor from "./RateChangeProcessor.js";
import PlannedPaymentChangeProcessor from "./PlannedPaymentChangeProcessor.js";
import RestructureProcessor from "./RestructureProcessor.js";

export default class EventPipelineProcessor extends BaseProcessor {

    constructor() {

        super();

        this.graceProcessor = new GraceProcessor();

        this.rateChangeProcessor =
            new RateChangeProcessor();

        this.plannedPaymentChangeProcessor =
            new PlannedPaymentChangeProcessor();

        this.restructureProcessor =
            new RestructureProcessor();

    }

    process(state) {

        const restructureEvent =
            this.restructureProcessor.process(
                state
            );

        return {

            restructureEvent,

            graceType: this.graceProcessor.process(
                state
            ),

            effectiveRate: this.rateChangeProcessor.process(
                state
            ),

            plannedPayment:
                this.plannedPaymentChangeProcessor.process(
                    state
                ),

            effectiveTerm: state.effectiveTerm

        };

    }

}