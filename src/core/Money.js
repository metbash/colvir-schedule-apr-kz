/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * Money.js
 *
 * Работа с денежными значениями.
 * Все расчеты денежных сумм выполняются только через этот класс.
 * ==========================================================
 */

import { CURRENCY, ROUNDING } from "./Constants.js";

export default class Money {

    /**
     * Банковское округление денежной суммы.
     *
     * @param {number} value
     * @returns {number}
     */
    static round(value) {

        if (!Number.isFinite(value)) {
            throw new TypeError("Money.round(): value must be a finite number.");
        }

        const factor = Math.pow(10, ROUNDING.MONEY);

        return Math.round((value + Number.EPSILON) * factor) / factor;

    }

    /**
     * Округление процентной ставки.
     *
     * @param {number} value
     * @returns {number}
     */
    static roundRate(value) {

        if (!Number.isFinite(value)) {
            throw new TypeError("Money.roundRate(): value must be a finite number.");
        }

        const factor = Math.pow(10, ROUNDING.RATE);

        return Math.round((value + Number.EPSILON) * factor) / factor;

    }

    /**
     * Сложение денежных сумм.
     */
    static add(a, b) {

        return Money.round(

            Number(a) + Number(b)

        );

    }

    /**
     * Вычитание денежных сумм.
     */
    static subtract(a, b) {

        return Money.round(

            Number(a) - Number(b)

        );

    }

    /**
     * Умножение.
     */
    static multiply(a, b) {

        return Money.round(

            Number(a) * Number(b)

        );

    }

    /**
     * Деление.
     */
    static divide(a, b) {

        if (Number(b) === 0) {
            throw new Error("Division by zero.");
        }

        return Money.round(

            Number(a) / Number(b)

        );

    }

    /**
     * Сравнение денежных сумм.
     */
    static equals(a, b) {

        return Money.round(a) === Money.round(b);

    }

    /**
     * Проверка на ноль.
     */
    static isZero(value) {

        return Math.abs(

            Money.round(value)

        ) < 0.01;

    }

    /**
     * Проверка положительного значения.
     */
    static isPositive(value) {

        return Money.round(value) > 0;

    }

    /**
     * Проверка отрицательного значения.
     */
    static isNegative(value) {

        return Money.round(value) < 0;

    }

    /**
     * Преобразование в денежный формат.
     */
    static format(value) {

        return Money.round(value).toLocaleString(

            "ru-KZ",

            {

                minimumFractionDigits: CURRENCY.FRACTION_DIGITS,

                maximumFractionDigits: CURRENCY.FRACTION_DIGITS

            }

        );

    }

    /**
     * Проверка числа.
     */
    static validate(value) {

        return Number.isFinite(value);

    }

}