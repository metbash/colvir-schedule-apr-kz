/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * CashFlowSet.js
 * ==========================================================
 */

import CashFlow from "./CashFlow.js";
import Money from "../core/Money.js";
import DateUtils from "../core/DateUtils.js";

export default class CashFlowSet {

    constructor(flows = []) {

        if (!Array.isArray(flows)) {
            throw new TypeError(
                "flows must be an array."
            );
        }

        for (const flow of flows) {
            if (!(flow instanceof CashFlow)) {
                throw new TypeError(
                    "CashFlowSet accepts only CashFlow objects."
                );
            }
        }

        this.flows = Object.freeze(
            [...flows]
        );

        Object.freeze(this);

    }

    get length() {
        return this.flows.length;
    }

    get(index) {
        return this.flows[index];
    }

    toArray() {
        return this.flows.slice();
    }

    sorted() {

        const sortedFlows = this.toArray().sort(
            (a, b) => a.date.getTime() - b.date.getTime()
        );

        return new CashFlowSet(
            sortedFlows
        );

    }

    baseDate() {

        if (this.flows.length === 0) {
            return null;
        }

        return this.sorted().get(0).date;

    }

    totalInflow() {

        return Money.round(
            this.flows.reduce((sum, flow) => {
                return flow.amount > 0
                    ? sum + flow.amount
                    : sum;
            }, 0)
        );

    }

    totalOutflow() {

        return Money.round(
            this.flows.reduce((sum, flow) => {
                return flow.amount < 0
                    ? sum + Math.abs(flow.amount)
                    : sum;
            }, 0)
        );

    }

    netAmount() {

        return Money.round(
            this.flows.reduce((sum, flow) => {
                return sum + flow.amount;
            }, 0)
        );

    }

    hasMixedSigns() {

        const hasPositive = this.flows.some(
            (flow) => flow.amount > 0
        );

        const hasNegative = this.flows.some(
            (flow) => flow.amount < 0
        );

        return hasPositive && hasNegative;

    }

    withAppended(flow) {

        if (!(flow instanceof CashFlow)) {
            throw new TypeError(
                "flow must be a CashFlow instance."
            );
        }

        return new CashFlowSet([
            ...this.flows,
            flow
        ]);

    }

    toJSON() {

        return {
            flows: this.flows.map(
                (flow) => flow.toJSON()
            )
        };

    }

}