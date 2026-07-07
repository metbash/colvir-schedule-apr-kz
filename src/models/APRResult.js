/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * APRResult.js
 * ==========================================================
 */

import Validation from "../core/Validation.js";
import Money from "../core/Money.js";

export default class APRResult {

    constructor({

        annualRate,

        annualPercentRate,

        converged,

        iterations,

        residual,

        basisDays,

        metadata = {}

    }) {

        Validation.requireNumber(
            "annualRate",
            annualRate
        );

        Validation.requireNumber(
            "annualPercentRate",
            annualPercentRate
        );

        if (typeof converged !== "boolean") {
            throw new TypeError(
                "converged must be boolean."
            );
        }

        Validation.requireInteger(
            "iterations",
            iterations
        );

        Validation.requireNumber(
            "residual",
            residual
        );

        Validation.requirePositive(
            "basisDays",
            basisDays
        );

        if (
            metadata === null ||
            typeof metadata !== "object" ||
            Array.isArray(metadata)
        ) {
            throw new TypeError(
                "metadata must be an object."
            );
        }

        this.annualRate = annualRate;

        this.annualPercentRate = Money.roundRate(
            annualPercentRate
        );

        this.converged = converged;

        this.iterations = iterations;

        this.residual = residual;

        this.basisDays = basisDays;

        this.metadata = Object.freeze({
            ...metadata
        });

        Object.freeze(this);

    }

    toJSON() {

        return {
            annualRate: this.annualRate,
            annualPercentRate: this.annualPercentRate,
            converged: this.converged,
            iterations: this.iterations,
            residual: this.residual,
            basisDays: this.basisDays,
            metadata: this.metadata
        };

    }

}