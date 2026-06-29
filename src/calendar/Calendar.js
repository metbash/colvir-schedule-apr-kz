/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * Calendar.js
 *
 * Базовый календарь.
 * ==========================================================
 */

import DateUtils from "../core/DateUtils.js";
import HolidayProvider from "./HolidayProvider.js";
import { BusinessDayConvention } from "../core/Enums.js";

export default class Calendar {

    constructor(
        holidayProvider = new HolidayProvider()
    ) {

        this.holidayProvider = holidayProvider;

    }

    isWeekend(date) {

        const day = date.getDay();

        return day === 0 || day === 6;

    }

    isHoliday(date) {

        return this.holidayProvider.isHoliday(date);

    }

    isBusinessDay(date) {

        return (
            !this.isWeekend(date) &&
            !this.isHoliday(date)
        );

    }

    nextBusinessDay(date) {

        let result = DateUtils.clone(date);

        while (!this.isBusinessDay(result)) {

            result = DateUtils.addDays(result, 1);

        }

        return result;

    }

    previousBusinessDay(date) {

        let result = DateUtils.clone(date);

        while (!this.isBusinessDay(result)) {

            result = DateUtils.addDays(result, -1);

        }

        return result;

    }

    adjustDate(
        date,
        convention = BusinessDayConvention.FOLLOWING
    ) {

        switch (convention) {

            case BusinessDayConvention.NONE:

                return DateUtils.clone(date);

            case BusinessDayConvention.FOLLOWING:

                return this.nextBusinessDay(date);

            case BusinessDayConvention.PRECEDING:

                return this.previousBusinessDay(date);

            case BusinessDayConvention.MODIFIED_FOLLOWING: {

                const adjusted =
                    this.nextBusinessDay(date);

                if (
                    adjusted.getMonth() !==
                    date.getMonth()
                ) {

                    return this.previousBusinessDay(date);

                }

                return adjusted;

            }

            case BusinessDayConvention.MODIFIED_PRECEDING: {

                const adjusted =
                    this.previousBusinessDay(date);

                if (
                    adjusted.getMonth() !==
                    date.getMonth()
                ) {

                    return this.nextBusinessDay(date);

                }

                return adjusted;

            }

            default:

                throw new Error(
                    "Unknown BusinessDayConvention."
                );

        }

    }

}