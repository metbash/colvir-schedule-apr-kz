/**
 * ==========================================================
 * Colvir Schedule & APR Calculator (KZ)
 * Version: 4.0-dev1
 *
 * KazakhstanCalendar.js
 *
 * Календарь Республики Казахстан.
 * ==========================================================
 */

import Calendar from "./Calendar.js";
import KazakhstanHolidayProvider from "./KazakhstanHolidayProvider.js";

export default class KazakhstanCalendar extends Calendar {

    constructor() {

        super(

            new KazakhstanHolidayProvider()

        );

    }

}