/**
 * ==========================================================
 * CalculationContext
 * ==========================================================
 */

import LoanState from "../models/LoanState.js";
import Schedule from "../models/Schedule.js";

export default class CalculationContext {

    constructor(loan, calendar) {

        this.loan = loan;

        this.calendar = calendar;

        this.state = new LoanState(loan);

        this.schedule = new Schedule();

        this.periodIndex = 0;

        this.currentDate = loan.issueDate;

        this.previousDate = loan.issueDate;

    }

}