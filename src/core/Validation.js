/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * Validation.js
 *
 * Общие проверки входных данных.
 * ==========================================================
 */

export default class Validation {

    static isNumber(value) {

        return Number.isFinite(value);

    }

    static isPositive(value) {

        return Number.isFinite(value) && value > 0;

    }

    static isPositiveOrZero(value) {

        return Number.isFinite(value) && value >= 0;

    }

    static isInteger(value) {

        return Number.isInteger(value);

    }

    static isDate(value) {

        return value instanceof Date && !Number.isNaN(value.getTime());

    }

    static requireNumber(name, value) {

        if (!Validation.isNumber(value)) {

            throw new TypeError(`${name} must be a valid number.`);

        }

    }

    static requirePositive(name, value) {

        Validation.requireNumber(name, value);

        if (value <= 0) {

            throw new RangeError(`${name} must be greater than zero.`);

        }

    }

    static requirePositiveOrZero(name, value) {

        Validation.requireNumber(name, value);

        if (value < 0) {

            throw new RangeError(`${name} must be greater than or equal to zero.`);

        }

    }

    static requireInteger(name, value) {

        if (!Validation.isInteger(value)) {

            throw new TypeError(`${name} must be an integer.`);

        }

    }

    static requireDate(name, value) {

        if (!Validation.isDate(value)) {

            throw new TypeError(`${name} must be a valid Date.`);

        }

    }

}